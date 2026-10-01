//! Native MCP adapters verified against upstream config schemas. Never launch MCP processes.
use crate::{
    config::{atomic_write, get_home_dir},
    error::AppError,
};
use serde_json::{json, Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};
const BEGIN: &str = "# HRouter MCP block — begin";
const END: &str = "# HRouter MCP block — end";
fn error(message: impl Into<String>) -> AppError {
    AppError::Config(message.into())
}
fn read(path: &Path) -> Result<Option<Vec<u8>>, AppError> {
    match fs::symlink_metadata(path) {
        Ok(meta) => {
            if !meta.is_file() || meta.len() > 4 * 1024 * 1024 {
                return Err(error(
                    "MCP configuration must be a regular file below 4 MiB",
                ));
            }
            fs::read(path).map(Some).map_err(|e| AppError::io(path, e))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(AppError::io(path, e)),
    }
}
fn path(app: &str) -> Result<PathBuf, AppError> {
    Ok(match app {
        "claude-desktop" => crate::claude_desktop_config::get_mcp_config_path()?,
        "pi" => crate::external_agents::pi_path()
            .map_err(error)?
            .with_file_name("mcp.json"),
        "workbuddy" => {
            let home = get_home_dir();
            let paths = [
                home.join(".codebuddy/.mcp.json"),
                home.join(".codebuddy/mcp.json"),
                home.join(".codebuddy.json"),
            ];
            paths
                .iter()
                .find(|p| p.exists())
                .unwrap_or(&paths[0])
                .clone()
        }
        "deepseek-harness" => crate::agent_configs::home_path(app).map_err(error)?,
        _ => return Err(error("Unknown MCP destination")),
    })
}
fn native_spec(app: &str, id: &str, spec: &Value) -> Result<Value, AppError> {
    if id.is_empty() || id == "__proto__" || id.chars().any(char::is_control) {
        return Err(error("Invalid MCP server name"));
    }
    let mut spec = spec.clone();
    let object = spec
        .as_object_mut()
        .ok_or_else(|| error("MCP configuration must be an object"))?;
    let transport = object
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or(if object.contains_key("url") {
            "http"
        } else {
            "stdio"
        })
        .to_owned();
    if !matches!(
        transport.as_str(),
        "stdio" | "http" | "streamable-http" | "sse"
    ) {
        return Err(error("Unknown MCP transport"));
    }
    if transport == "stdio"
        && !object
            .get("command")
            .and_then(Value::as_str)
            .is_some_and(|s| !s.trim().is_empty())
    {
        return Err(error("Stdio MCP requires an executable"));
    }
    if transport != "stdio"
        && !object
            .get("url")
            .and_then(Value::as_str)
            .is_some_and(|s| s.starts_with("https://") || s.starts_with("http://"))
    {
        return Err(error("Remote MCP requires an HTTP(S) URL"));
    }
    if app == "claude-desktop" && transport != "stdio" {
        return Err(error("Claude Desktop config supports stdio MCP. Add remote connectors in Claude's account settings."));
    }
    if matches!(app, "pi" | "deepseek-harness") {
        if !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
            || (app == "deepseek-harness" && id.len() > 32)
        {
            return Err(error("MCP name must contain letters, digits, underscores or hyphens (Harness maximum: 32 characters)"));
        }
        if transport == "sse" {
            return Err(error(
                "This Agent requires Streamable HTTP rather than legacy SSE",
            ));
        }
    }
    if matches!(app, "openclaw" | "deepseek-harness") {
        object.remove("type");
        object.insert(
            "transport".into(),
            json!(if transport == "http" {
                "streamable-http"
            } else {
                &transport
            }),
        );
    }
    if matches!(app, "openclaw" | "pi") {
        object.insert("enabled".into(), json!(true));
    }
    if app == "deepseek-harness" {
        object.insert("serverName".into(), json!(id));
    }
    Ok(spec)
}
fn json_merge(
    app: &str,
    id: &str,
    spec: Option<&Value>,
    before: Option<&[u8]>,
) -> Result<Vec<u8>, AppError> {
    let mut doc: Value = match before {
        Some(bytes) => json5::from_str(
            std::str::from_utf8(bytes).map_err(|_| error("MCP config is not UTF-8"))?,
        )
        .map_err(|_| error("Invalid MCP JSON; file was not changed"))?,
        None => json!({}),
    };
    let root = doc
        .as_object_mut()
        .ok_or_else(|| error("MCP root must be an object"))?;
    let map = root
        .entry("mcpServers")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| error("mcpServers must be an object"))?;
    if let Some(spec) = spec {
        // Pi treats '-' and '_' as the same namespace.
        if app == "pi"
            && map
                .keys()
                .any(|other| other != id && other.replace('-', "_") == id.replace('-', "_"))
        {
            return Err(error(
                "Pi MCP server namespace collides with an existing server",
            ));
        }
        map.insert(id.into(), native_spec(app, id, spec)?);
    } else {
        map.remove(id);
    }
    serde_json::to_vec_pretty(&doc).map_err(|e| error(e.to_string()))
}
fn harness_parts(before: Option<&[u8]>) -> Result<(String, String, Vec<Value>), AppError> {
    let text = std::str::from_utf8(before.unwrap_or_default())
        .map_err(|_| error("Harness patch must be UTF-8"))?;
    let parsed: serde_yaml::Value = serde_yaml::from_str(text)
        .map_err(|_| error("Invalid Harness YAML; file was not changed"))?;
    if !parsed.is_null() && !parsed.is_sequence() {
        return Err(error("Harness patch must be a list"));
    }
    let starts: Vec<_> = text.match_indices(BEGIN).collect();
    let ends: Vec<_> = text.match_indices(END).collect();
    let (prefix, suffix, entries) = match (starts.as_slice(), ends.as_slice()) {
        ([], []) => (text.to_owned(), String::new(), vec![]),
        ([(a, _)], [(b, _)])
            if a < b
                && (*a == 0 || text.as_bytes()[a - 1] == b'\n')
                && *b > 0
                && text.as_bytes()[b - 1] == b'\n' =>
        {
            let entries: Vec<Value> = serde_yaml::from_str(&text[a + BEGIN.len()..*b])
                .map_err(|_| error("Invalid managed MCP block"))?;
            (
                text[..*a].to_owned(),
                text[b + END.len()..].to_owned(),
                entries,
            )
        }
        _ => return Err(error("Conflicting Harness MCP block markers")),
    };
    let outside = format!("{prefix}{suffix}");
    if outside
        .lines()
        .any(|l| !l.trim().starts_with('#') && (l.trim().starts_with('[') || l.trim() == "..."))
    {
        return Err(error(
            "Harness patch must use block-style YAML without a document end marker",
        ));
    }
    for entry in &entries {
        let inserts = entry["insert"]
            .as_array()
            .ok_or_else(|| error("Managed Harness MCP patch was changed"))?;
        if inserts.len() != 1
            || inserts[0]["name"] != "@deepseek-ai/dsh-mcp-client"
            || !inserts[0]["id"]
                .as_str()
                .is_some_and(|s| s.starts_with("hrouter-mcp-"))
        {
            return Err(error("Managed Harness MCP patch was changed"));
        }
    }
    Ok((prefix, suffix, entries))
}
fn harness_merge(
    id: &str,
    spec: Option<&Value>,
    before: Option<&[u8]>,
) -> Result<Vec<u8>, AppError> {
    let (prefix, suffix, mut entries) = harness_parts(before)?;
    let plugin_id = format!("hrouter-mcp-{id}");
    let outside: serde_yaml::Value = serde_yaml::from_str(&format!("{prefix}{suffix}"))
        .map_err(|_| error("Invalid unmanaged Harness patch"))?;
    fn conflicts(v: &serde_yaml::Value, id: &str, plugin_id: &str) -> bool {
        match v {
            serde_yaml::Value::Mapping(m) => m.iter().any(|(k, v)| {
                (k.as_str() == Some("serverName") && v.as_str() == Some(id))
                    || (k.as_str() == Some("id") && v.as_str() == Some(plugin_id))
                    || conflicts(v, id, plugin_id)
            }),
            serde_yaml::Value::Sequence(items) => items.iter().any(|v| conflicts(v, id, plugin_id)),
            serde_yaml::Value::Tagged(t) => conflicts(&t.value, id, plugin_id),
            _ => false,
        }
    }
    if conflicts(&outside, id, &plugin_id) {
        return Err(error(
            "Harness already defines this MCP server outside the managed block",
        ));
    }
    entries.retain(|e| e["insert"][0]["id"] != plugin_id);
    if let Some(spec) = spec {
        entries.push(json!({"insert":[{"id":plugin_id,"name":"@deepseek-ai/dsh-mcp-client","config":native_spec("deepseek-harness",id,spec)?}]}));
    }
    let block = if entries.is_empty() {
        String::new()
    } else {
        format!(
            "{BEGIN}\n{}{END}\n",
            serde_yaml::to_string(&entries).map_err(|e| error(e.to_string()))?
        )
    };
    let out = format!(
        "{prefix}{}{block}{suffix}",
        if prefix.is_empty() || prefix.ends_with('\n') {
            ""
        } else {
            "\n"
        }
    );
    let _: serde_yaml::Value =
        serde_yaml::from_str(&out).map_err(|_| error("Invalid merged Harness YAML"))?;
    Ok(out.into_bytes())
}
pub fn preflight(app: &str, id: &str, spec: Option<&Value>) -> Result<(), AppError> {
    if let Some(spec) = spec {
        native_spec(app, id, spec)?;
    }
    if app == "openclaw" {
        let doc = crate::openclaw_config::read_openclaw_config()?;
        if doc.get("mcp").is_some_and(|v| !v.is_object())
            || doc.pointer("/mcp/servers").is_some_and(|v| !v.is_object())
        {
            return Err(error("OpenClaw MCP settings must be objects"));
        }
        return Ok(());
    }
    let before = read(&path(app)?)?;
    if app == "deepseek-harness" {
        harness_merge(id, spec, before.as_deref())?;
    } else {
        json_merge(app, id, spec, before.as_deref())?;
    }
    Ok(())
}
pub fn write_server(app: &str, id: &str, spec: Option<&Value>) -> Result<(), AppError> {
    crate::access_protection::require_full_mode()?;
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    let _guard = LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| error("MCP write lock unavailable"))?;
    if app == "openclaw" {
        let spec = spec.map(|s| native_spec(app, id, s)).transpose()?;
        return crate::openclaw_config::set_mcp_server(id, spec.as_ref());
    }
    let path = path(app)?;
    let before = read(&path)?;
    if before.is_none() && spec.is_none() {
        return Ok(());
    }
    let after = if app == "deepseek-harness" {
        harness_merge(id, spec, before.as_deref())?
    } else {
        json_merge(app, id, spec, before.as_deref())?
    };
    if before.as_deref() == Some(&after) {
        return Ok(());
    }
    if read(&path)? != before {
        return Err(error("MCP config changed while editing; retry"));
    }
    if let Some(bytes) = before {
        let backup = path.with_file_name(format!(
            "{}.hrouter-{}.bak",
            path.file_name().unwrap_or_default().to_string_lossy(),
            uuid::Uuid::new_v4()
        ));
        atomic_write(&backup, &bytes)?;
    }
    atomic_write(&path, &after)
}
pub fn read_servers(app: &str) -> Result<Map<String, Value>, AppError> {
    if app == "openclaw" {
        return Ok(crate::openclaw_config::read_openclaw_config()?
            .pointer("/mcp/servers")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default());
    }
    let before = read(&path(app)?)?;
    if app == "deepseek-harness" {
        let (_, _, entries) = harness_parts(before.as_deref())?;
        return Ok(entries
            .iter()
            .filter_map(|e| {
                let config = &e["insert"][0]["config"];
                Some((config["serverName"].as_str()?.to_owned(), config.clone()))
            })
            .collect());
    }
    let Some(bytes) = before else {
        return Ok(Map::new());
    };
    let doc: Value =
        json5::from_str(std::str::from_utf8(&bytes).map_err(|_| error("Invalid UTF-8"))?)
            .map_err(|_| error("Invalid MCP JSON"))?;
    match doc.get("mcpServers") {
        None => Ok(Map::new()),
        Some(value) => value
            .as_object()
            .cloned()
            .ok_or_else(|| error("mcpServers must be an object")),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn json_clients_preserve_other_servers_and_fields() {
        for app in ["claude-desktop", "pi", "workbuddy"] {
            let before = br#"{"theme":"dark","mcpServers":{"foreign":{"command":"keep"}}}"#;
            let after = json_merge(
                app,
                "ours",
                Some(&json!({"command":"node","args":["tool.js"]})),
                Some(before),
            )
            .unwrap();
            let doc: Value = serde_json::from_slice(&after).unwrap();
            assert_eq!(doc["theme"], "dark");
            assert_eq!(doc["mcpServers"]["foreign"]["command"], "keep");
            let removed = json_merge(app, "ours", None, Some(&after)).unwrap();
            let doc: Value = serde_json::from_slice(&removed).unwrap();
            assert!(doc["mcpServers"].get("ours").is_none());
            assert!(doc["mcpServers"].get("foreign").is_some());
        }
    }
    #[test]
    fn protocol_translation_and_constraints_are_explicit() {
        let http = json!({"type":"http","url":"https://example.test/mcp"});
        assert_eq!(
            native_spec("openclaw", "a", &http).unwrap()["transport"],
            "streamable-http"
        );
        assert_eq!(
            native_spec("deepseek-harness", "a", &http).unwrap()["serverName"],
            "a"
        );
        assert!(native_spec("claude-desktop", "a", &http).is_err());
        assert!(native_spec(
            "pi",
            "a",
            &json!({"type":"sse","url":"https://example.test"})
        )
        .is_err());
        assert!(json_merge(
            "pi",
            "foo-bar",
            Some(&http),
            Some(br#"{"mcpServers":{"foo_bar":{}}}"#)
        )
        .is_err());
    }
    #[test]
    fn harness_patch_roundtrip_preserves_tags_comments_and_other_plugins() {
        let before=b"# existing\n- insert:\n    - id: mine\n      name: custom\n      config:\n        secret: !!js process.env.KEY\n";
        let after = harness_merge(
            "docs",
            Some(&json!({"type":"http","url":"https://example.test/mcp"})),
            Some(before),
        )
        .unwrap();
        assert!(after.starts_with(before));
        assert_eq!(harness_parts(Some(&after)).unwrap().2.len(), 1);
        let replaced =
            harness_merge("docs", Some(&json!({"command":"node"})), Some(&after)).unwrap();
        assert_eq!(harness_parts(Some(&replaced)).unwrap().2.len(), 1);
        let removed = harness_merge("docs", None, Some(&replaced)).unwrap();
        assert!(removed.starts_with(before));
        assert!(!String::from_utf8(removed).unwrap().contains(BEGIN));
    }
    #[test]
    fn malformed_and_conflicting_native_configs_are_not_overwritten() {
        assert!(json_merge(
            "pi",
            "ours",
            Some(&json!({"command":"node"})),
            Some(b"{broken")
        )
        .is_err());
        assert!(harness_merge(
            "docs",
            Some(&json!({"command":"node"})),
            Some(b"- insert:\n  - name: other\n    config:\n      serverName: docs\n")
        )
        .is_err());
        assert!(harness_merge("docs", Some(&json!({"command":"node"})), Some(b"[]")).is_err());
    }
}
