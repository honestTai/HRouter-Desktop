//! Adapter sources and schema verification: docs/testing/unified-agent-configs-2026-10-01.md.
//! Only model configuration is modified; credentials are redacted on reads.
use crate::external_agents::{self as pi, PiApplied, PiConnection, PiPreview};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const BEGIN: &str = "# HRouter provider block — begin";
const END: &str = "# HRouter provider block — end";
const ENTRY: &str = "hrouter-managed-provider";
const ROUTE: &str = "hrouter";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigState {
    path: String,
    existed: bool,
    pub(super) connections: Vec<PiConnection>,
}
pub(super) fn home_path(agent: &str) -> Result<PathBuf, String> {
    let home = crate::config::get_home_dir();
    let home = home.canonicalize().unwrap_or(home);
    match agent {
        "pi" => pi::pi_path(),
        "workbuddy" => Ok(home.join(".codebuddy/models.json")),
        "deepseek-harness" => {
            let root = if std::env::var_os("CC_SWITCH_TEST_HOME").is_some() {
                home.join(".dsh")
            } else if let Some(value) =
                std::env::var_os("DSH_HOME").filter(|s| !s.to_string_lossy().trim().is_empty())
            {
                let s = value.to_string_lossy();
                if s == "~" {
                    home.clone()
                } else if s.starts_with("~/") || s.starts_with("~\\") {
                    home.join(&s[2..])
                } else {
                    PathBuf::from(value)
                }
            } else {
                home.join(".dsh")
            };
            if !root.is_absolute() {
                return Err("DSH_HOME must be absolute in HRouter; relative paths depend on the Harness launch directory".into());
            }
            Ok(root.join("cordis.patch.yml"))
        }
        _ => Err("Unsupported agent".into()),
    }
}
fn json_doc(bytes: Option<&[u8]>) -> Result<Value, String> {
    let doc = match bytes {
        Some(b) => serde_json::from_slice(b)
            .map_err(|_| "Invalid configuration JSON; file was not changed")?,
        None => json!({}),
    };
    if !doc.is_object() {
        return Err("Configuration must be a JSON object".into());
    }
    Ok(doc)
}
fn models(value: &Value) -> Result<&Vec<Value>, String> {
    let rows = value.as_array().ok_or("Models must be an array")?;
    if rows
        .iter()
        .any(|m| !m.is_object() || !m.get("id").is_some_and(Value::is_string))
    {
        return Err("Invalid model entries; refusing to overwrite".into());
    }
    let mut ids = std::collections::HashSet::new();
    if rows.iter().any(|m| !ids.insert(m["id"].as_str().unwrap())) {
        return Err("Duplicate model IDs; resolve them in the configuration first".into());
    }
    Ok(rows)
}
fn encode(doc: &Value) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec_pretty(doc).map_err(|_| "Cannot encode configuration")?;
    bytes.push(b'\n');
    Ok(bytes)
}
fn workbuddy(
    input: &PiConnection,
    before: Option<&[u8]>,
) -> Result<(Vec<u8>, bool, usize), String> {
    if input.api != "openai-completions"
        || !matches!(input.credential_mode.as_str(), "literal" | "keep")
    {
        return Err("WorkBuddy models.json requires an OpenAI Chat Completions endpoint and a literal API key".into());
    }
    let mut doc = json_doc(before)?;
    doc.as_object_mut()
        .unwrap()
        .entry("models")
        .or_insert_with(|| json!([]));
    models(&doc["models"])?;
    let rows = doc["models"].as_array_mut().unwrap();
    let existing = rows.iter().position(|m| m["id"] == input.model.trim());
    if existing.is_none() {
        rows.push(json!({"id":input.model.trim(),"name":input.model.trim(),"vendor":"HRouter","supportsToolCall":true}));
    }
    let index = existing.unwrap_or(rows.len() - 1);
    let row = rows[index].as_object_mut().unwrap();
    let base = input.base_url.trim().trim_end_matches('/');
    let endpoint = if base.ends_with("/chat/completions") {
        base.to_owned()
    } else {
        format!("{base}/chat/completions")
    };
    row.insert("url".into(), json!(endpoint));
    if input.credential_mode == "keep" {
        if row
            .get("apiKey")
            .is_none_or(|v| v.as_str().is_none_or(|s| s.is_empty()))
        {
            return Err("This model has no saved API key; enter a key".into());
        }
    } else {
        row.insert("apiKey".into(), json!(input.credential.trim()));
    }
    let count = rows.len();
    if let Some(visible) = doc.get_mut("availableModels") {
        let list = visible
            .as_array_mut()
            .ok_or("availableModels must be an array")?;
        if list.iter().any(|v| !v.is_string()) {
            return Err("Invalid availableModels list".into());
        }
        if !list.is_empty() && !list.iter().any(|v| v == input.model.trim()) {
            list.push(json!(input.model.trim()));
        }
    }
    Ok((encode(&doc)?, existing.is_some(), count))
}

// Preserve all bytes outside our marked block, including comments and !!js expressions.
// A dedicated inserted adapter avoids replacing an inherited plugin's entire config.
fn harness_parts(before: Option<&[u8]>) -> Result<(String, String, Option<Value>), String> {
    let text =
        std::str::from_utf8(before.unwrap_or(b"")).map_err(|_| "Harness config must be UTF-8")?;
    let parsed: serde_yaml::Value =
        serde_yaml::from_str(text).map_err(|_| "Invalid Harness YAML; file was not changed")?;
    if !parsed.is_null() && !parsed.is_sequence() {
        return Err("Harness patch must be a YAML list".into());
    }
    // An empty flow list is a common initial file. Retain it as a comment before
    // adding block-style entries; non-empty flow documents are refused below.
    let expanded;
    let text = if parsed.as_sequence().is_some_and(Vec::is_empty) {
        expanded = text
            .split_inclusive('\n')
            .map(|line| {
                if line.trim_start().starts_with("[]") {
                    format!("# {line}")
                } else {
                    line.to_owned()
                }
            })
            .collect::<String>();
        expanded.as_str()
    } else {
        text
    };
    let begin: Vec<_> = text.match_indices(BEGIN).collect();
    let end: Vec<_> = text.match_indices(END).collect();
    let (prefix, suffix, block) = match (begin.as_slice(), end.as_slice()) {
        ([], []) => (text.to_owned(), String::new(), None),
        ([(b, _)], [(e, _)])
            if b < e
                && (*b == 0 || text.as_bytes()[b - 1] == b'\n')
                && text.as_bytes()[e - 1] == b'\n' =>
        {
            let tail = e + END.len();
            if !text[tail..].is_empty()
                && !text[tail..].starts_with('\n')
                && !text[tail..].starts_with("\r\n")
            {
                return Err("Malformed HRouter block marker".into());
            }
            let block: Value = serde_yaml::from_str(&text[b + BEGIN.len()..*e])
                .map_err(|_| "Invalid managed Harness block")?;
            (text[..*b].to_owned(), text[tail..].to_owned(), Some(block))
        }
        _ => return Err("Ambiguous HRouter block markers; refusing to overwrite".into()),
    };
    let outside = format!("{prefix}{suffix}");
    let other: serde_yaml::Value = serde_yaml::from_str(&outside)
        .map_err(|_| "Cannot safely isolate the managed Harness block")?;
    fn conflict(v: &serde_yaml::Value) -> bool {
        match v {
            serde_yaml::Value::Mapping(m) => m.iter().any(|(k, v)| {
                (k.as_str() == Some("id") && v.as_str() == Some(ENTRY))
                    || (k.as_str() == Some("providers")
                        && v.as_mapping().is_some_and(|p| {
                            p.contains_key(serde_yaml::Value::String(ROUTE.into()))
                        }))
                    || conflict(v)
            }),
            serde_yaml::Value::Sequence(s) => s.iter().any(conflict),
            serde_yaml::Value::Tagged(t) => conflict(&t.value),
            _ => false,
        }
    }
    if conflict(&other) {
        return Err("Harness already defines the HRouter route outside the managed block; resolve that conflict first".into());
    }
    // Appending block-style YAML to a flow list or an explicit document end is unsafe.
    if outside.lines().any(|l| {
        let s = l.trim();
        !s.starts_with('#') && (s.starts_with('[') || s == "...")
    }) {
        return Err("Harness flow-style YAML or explicit document end cannot be extended safely; use a block-style patch list".into());
    }
    Ok((prefix, suffix, block))
}
fn harness_doc(block: Option<Value>) -> Result<Value, String> {
    let doc = block.unwrap_or_else(|| json!([{"insert":[{"id":ENTRY,"name":"@deepseek-ai/dsh-llm-pi-ai","config":{"providers":{}}}]}]));
    if doc.as_array().map(Vec::len) != Some(1)
        || doc[0]["insert"].as_array().map(Vec::len) != Some(1)
        || doc[0]["insert"][0]["id"] != ENTRY
        || doc[0]["insert"][0]["name"] != "@deepseek-ai/dsh-llm-pi-ai"
        || !doc[0]["insert"][0]["config"]["providers"].is_object()
    {
        return Err("Managed Harness block was structurally changed; refusing to overwrite".into());
    }
    Ok(doc)
}
fn harness(input: &PiConnection, before: Option<&[u8]>) -> Result<(Vec<u8>, bool, usize), String> {
    if !matches!(input.credential_mode.as_str(), "env" | "keep") {
        return Err("Harness requires an environment variable reference".into());
    }
    let (prefix, suffix, block) = harness_parts(before)?;
    let mut doc = harness_doc(block)?;
    let providers = doc[0]["insert"][0]["config"]["providers"]
        .as_object_mut()
        .unwrap();
    let existed = providers.contains_key(ROUTE);
    let route = providers
        .entry(ROUTE)
        .or_insert_with(|| json!({"displayName":"HRouter","models":[]}))
        .as_object_mut()
        .ok_or("Harness route must be an object")?;
    route.insert(
        "baseURL".into(),
        json!(input.base_url.trim().trim_end_matches('/')),
    );
    route.insert("api".into(), json!(input.api));
    if input.credential_mode == "keep" {
        if !route.get("apiKeyEnv").is_some_and(Value::is_string) {
            return Err("No saved Harness credential reference".into());
        }
    } else {
        route.insert("apiKeyEnv".into(), json!(input.credential.trim()));
    }
    let rows = route.entry("models").or_insert_with(|| json!([]));
    models(rows)?;
    let rows = rows.as_array_mut().unwrap();
    if !rows.iter().any(|m| m["id"] == input.model.trim()) {
        rows.push(json!({"id":input.model.trim()}));
    }
    let count = rows.len();
    let yaml = serde_yaml::to_string(&doc).map_err(|_| "Cannot encode Harness patch")?;
    let newline = if prefix.is_empty() || prefix.ends_with('\n') {
        ""
    } else {
        "\n"
    };
    let result = format!("{prefix}{newline}{BEGIN}\n{yaml}{END}\n{suffix}");
    let _: serde_yaml::Value = serde_yaml::from_str(&result)
        .map_err(|_| "Merged Harness patch is invalid; file was not changed")?;
    Ok((result.into_bytes(), existed, count))
}
pub(super) fn build(
    agent: &str,
    input: &PiConnection,
    before: Option<&[u8]>,
) -> Result<(Vec<u8>, bool, usize), String> {
    // Shared URL, model, protocol and credential validation; keep mode is validated against saved data by each adapter.
    let mut check = input.clone();
    if check.credential_mode == "keep" {
        check.credential_mode = "env".into();
        check.credential = "HROUTER_VALIDATION".into();
    }
    // WorkBuddy keys are literal data, never interpreted as Pi commands.
    if agent == "workbuddy" && check.credential_mode == "literal" {
        if check.credential.trim().is_empty()
            || check.credential.len() > 8192
            || check.credential.chars().any(char::is_control)
        {
            return Err("Invalid API key".into());
        }
        check.credential_mode = "env".into();
        check.credential = "HROUTER_VALIDATION".into();
    }
    pi::merged(&check, None)?;
    match agent {
        "pi" => {
            let (doc, exists, count) = pi::merged(input, before)?;
            Ok((encode(&doc)?, exists, count))
        }
        "workbuddy" => workbuddy(input, before),
        "deepseek-harness" => harness(input, before),
        _ => Err("Unsupported agent".into()),
    }
}
type ReviewedConfiguration = (PiPreview, Vec<u8>, Option<Vec<u8>>);

pub(super) fn review(
    agent: &str,
    path: &Path,
    input: &PiConnection,
) -> Result<ReviewedConfiguration, String> {
    let before = pi::read(path)?;
    let (after, updating_provider, model_count) = build(agent, input, before.as_deref())?;
    let mut hash = Sha256::new();
    hash.update(agent);
    hash.update(path.to_string_lossy().as_bytes());
    hash.update([u8::from(before.is_some())]);
    hash.update(before.as_deref().unwrap_or_default());
    hash.update(&after);
    Ok((
        PiPreview {
            path: path.display().to_string(),
            fingerprint: format!("{:x}", hash.finalize()),
            existed: before.is_some(),
            updating_provider,
            model_count,
        },
        after,
        before,
    ))
}
pub(super) fn apply_at(
    agent: &str,
    path: &Path,
    input: &PiConnection,
    fingerprint: &str,
) -> Result<PiApplied, String> {
    let _lock = pi::PI_WRITE_LOCK
        .lock()
        .map_err(|_| "Configuration is busy")?;
    let (preview, after, before) = review(agent, path, input)?;
    if preview.fingerprint != fingerprint {
        return Err("Configuration changed after preview; preview again".into());
    }
    let backup_path = if let Some(bytes) = &before {
        let backup = path
            .parent()
            .ok_or("Invalid path")?
            .join("hrouter-backups")
            .join(format!(
                "{}-{}",
                uuid::Uuid::new_v4(),
                path.file_name().unwrap().to_string_lossy()
            ));
        pi::private_atomic_write(&backup, bytes)?;
        Some(backup.display().to_string())
    } else {
        None
    };
    if pi::read(path)? != before {
        return Err("Configuration changed during backup; preview again".into());
    }
    pi::private_atomic_write(path, &after)?;
    Ok(PiApplied {
        path: preview.path,
        backup_path,
    })
}
pub(super) fn inspect_at(agent: &str, path: &Path) -> Result<ConfigState, String> {
    let before = pi::read(path)?;
    let mut connections = vec![];
    let mut add = |row: &Value, model: &str, url_key: &str, key_key: &str| {
        let raw = row.get(key_key).and_then(Value::as_str).unwrap_or("");
        let env = if agent == "deepseek-harness" {
            Some(raw)
        } else if agent == "pi" {
            raw.strip_prefix("${")
                .and_then(|v| v.strip_suffix('}'))
                .or_else(|| raw.strip_prefix('$'))
        } else {
            None
        };
        connections.push(PiConnection {
            base_url: row
                .get(url_key)
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned(),
            model: model.to_owned(),
            api: row
                .get("api")
                .and_then(Value::as_str)
                .unwrap_or("openai-completions")
                .to_owned(),
            credential_mode: if env.is_some() { "env" } else { "keep" }.into(),
            credential: env.unwrap_or("").to_owned(),
        });
    };
    match agent {
        "pi" | "workbuddy" => {
            let doc = json_doc(before.as_deref())?;
            if agent == "workbuddy" {
                if let Some(rows) = doc.get("models") {
                    for row in models(rows)? {
                        add(row, row["id"].as_str().unwrap(), "url", "apiKey");
                    }
                }
            } else {
                if let Some(providers) = doc.get("providers") {
                    if !providers.is_object() {
                        return Err("Pi providers must be an object".into());
                    }
                    if let Some(route) = providers.get(ROUTE) {
                        if !route.is_object() {
                            return Err("Pi route must be an object".into());
                        }
                        if let Some(rows) = route.get("models") {
                            for row in models(rows)? {
                                add(route, row["id"].as_str().unwrap(), "baseUrl", "apiKey");
                            }
                        }
                    }
                }
            }
        }
        "deepseek-harness" => {
            let (_, _, block) = harness_parts(before.as_deref())?;
            let doc = harness_doc(block)?;
            if let Some(route) = doc[0]["insert"][0]["config"]["providers"].get(ROUTE) {
                if !route.is_object() {
                    return Err("Harness route must be an object".into());
                }
                if let Some(rows) = route.get("models") {
                    for row in models(rows)? {
                        add(route, row["id"].as_str().unwrap(), "baseURL", "apiKeyEnv");
                    }
                }
            }
        }
        _ => return Err("Unsupported agent".into()),
    }
    Ok(ConfigState {
        path: path.display().to_string(),
        existed: before.is_some(),
        connections,
    })
}
#[tauri::command]
pub fn inspect_agent_config(agent: String) -> Result<ConfigState, String> {
    inspect_at(&agent, &home_path(&agent)?)
}
#[tauri::command]
pub fn preview_agent_config(agent: String, input: PiConnection) -> Result<PiPreview, String> {
    Ok(review(&agent, &home_path(&agent)?, &input)?.0)
}
#[tauri::command]
pub fn apply_agent_config(
    agent: String,
    input: PiConnection,
    fingerprint: String,
) -> Result<PiApplied, String> {
    apply_at(&agent, &home_path(&agent)?, &input, &fingerprint)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input(agent: &str) -> PiConnection {
        PiConnection {
            base_url: "https://relay.example/v1".into(),
            model: "test-model".into(),
            api: "openai-completions".into(),
            credential_mode: if agent == "workbuddy" {
                "literal"
            } else {
                "env"
            }
            .into(),
            credential: if agent == "workbuddy" {
                "test-secret"
            } else {
                "HROUTER_API_KEY"
            }
            .into(),
        }
    }
    fn temp_path(name: &str) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().canonicalize().unwrap().join(name);
        (dir, p)
    }
    #[test]
    fn all_adapters_preview_backup_roundtrip_and_redact() {
        for agent in ["pi", "deepseek-harness", "workbuddy"] {
            let (_dir, path) = temp_path(if agent == "deepseek-harness" {
                "cordis.patch.yml"
            } else {
                "models.json"
            });
            let original = if agent == "deepseek-harness" {
                b"# keep my comments\n- id: unrelated\n  disabled: !!js \"true\"\n".to_vec()
            } else {
                b"{\"untouched\": true}\n".to_vec()
            };
            std::fs::write(&path, &original).unwrap();
            let request = input(agent);
            let (p, _, _) = review(agent, &path, &request).unwrap();
            assert_eq!(std::fs::read(&path).unwrap(), original);
            let applied = apply_at(agent, &path, &request, &p.fingerprint).unwrap();
            assert_eq!(
                std::fs::read(applied.backup_path.unwrap()).unwrap(),
                original
            );
            let state = inspect_at(agent, &path).unwrap();
            assert_eq!(state.connections.len(), 1);
            assert_eq!(state.connections[0].model, "test-model");
            assert!(!serde_json::to_string(&state)
                .unwrap()
                .contains("test-secret"));
            if agent == "deepseek-harness" {
                assert!(std::fs::read(&path).unwrap().starts_with(&original));
            } else {
                assert_eq!(
                    json_doc(Some(&std::fs::read(&path).unwrap())).unwrap()["untouched"],
                    true
                );
            }
            let mut edit = state.connections[0].clone();
            edit.base_url = "https://new.example/v1".into();
            let (p, _, _) = review(agent, &path, &edit).unwrap();
            apply_at(agent, &path, &edit, &p.fingerprint).unwrap();
            assert_eq!(inspect_at(agent, &path).unwrap().connections.len(), 1);
            if agent == "workbuddy" {
                assert_eq!(
                    json_doc(Some(&std::fs::read(&path).unwrap())).unwrap()["models"][0]["apiKey"],
                    "test-secret"
                );
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                assert_eq!(
                    std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                    0o600
                );
            }
        }
    }
    #[test]
    fn stale_file_form_and_agent_are_rejected() {
        for agent in ["pi", "deepseek-harness", "workbuddy"] {
            let (_dir, path) = temp_path("config");
            let request = input(agent);
            let (p, _, _) = review(agent, &path, &request).unwrap();
            let mut changed = request.clone();
            changed.model = "other".into();
            assert!(apply_at(agent, &path, &changed, &p.fingerprint).is_err());
            assert!(!path.exists());
            let bytes = if agent == "deepseek-harness" {
                "# changed\n"
            } else {
                "{\"changed\":true}"
            };
            std::fs::write(&path, bytes).unwrap();
            assert!(apply_at(agent, &path, &request, &p.fingerprint).is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), bytes);
        }
    }
    #[test]
    fn workbuddy_keeps_metadata_filters_and_endpoint() {
        let request = input("workbuddy");
        let before = json!({"extra":42,"models":[{"id":"test-model","supportsImages":true,"maxInputTokens":1234,"apiKey":"old"},{"id":"other","url":"unchanged"}],"availableModels":["other"]});
        let (after, update, count) =
            build("workbuddy", &request, Some(&encode(&before).unwrap())).unwrap();
        let doc: Value = serde_json::from_slice(&after).unwrap();
        assert!(update);
        assert_eq!(count, 2);
        assert_eq!(doc["extra"], 42);
        assert_eq!(doc["models"][0]["supportsImages"], true);
        assert_eq!(doc["models"][0]["maxInputTokens"], 1234);
        assert_eq!(doc["models"][1], before["models"][1]);
        assert_eq!(
            doc["models"][0]["url"],
            "https://relay.example/v1/chat/completions"
        );
        assert_eq!(doc["availableModels"], json!(["other", "test-model"]));
        let mut full = request;
        full.base_url = "https://relay.example/v1/chat/completions".into();
        assert_eq!(build("workbuddy", &full, Some(&after)).unwrap().0, after);
    }
    #[test]
    fn invalid_shapes_credentials_and_missing_keep_refuse() {
        for agent in ["pi", "deepseek-harness", "workbuddy"] {
            let mut keep = input(agent);
            keep.credential_mode = "keep".into();
            keep.credential.clear();
            assert!(build(agent, &keep, None).is_err());
        }
        let mut req = input("workbuddy");
        req.credential_mode = "env".into();
        assert!(build("workbuddy", &req, None).is_err());
        req = input("deepseek-harness");
        req.credential_mode = "literal".into();
        assert!(build("deepseek-harness", &req, None).is_err());
        for bad in [
            "[]",
            "{bad",
            r#"{"models":{}}"#,
            r#"{"models":[{"id":"same"},{"id":"same"}]}"#,
            r#"{"availableModels":false}"#,
        ] {
            assert!(build("workbuddy", &input("workbuddy"), Some(bad.as_bytes())).is_err());
        }
        for bad in [
            "{}",
            "invalid: [",
            "[]\n---\n[]",
            "# HRouter provider block — begin\n",
            "- insert:\n  - id: other\n    config:\n      providers:\n        hrouter: {}\n",
        ] {
            assert!(
                build(
                    "deepseek-harness",
                    &input("deepseek-harness"),
                    Some(bad.as_bytes())
                )
                .is_err(),
                "{bad}"
            );
        }
    }
    #[test]
    fn harness_empty_list_can_be_extended() {
        let (bytes, _, _) = build(
            "deepseek-harness",
            &input("deepseek-harness"),
            Some(b"# original\n[] # empty\n"),
        )
        .unwrap();
        assert!(String::from_utf8_lossy(&bytes).starts_with("# original\n# [] # empty\n"));
        assert!(harness_parts(Some(&bytes)).unwrap().2.is_some());
    }
    #[test]
    fn harness_update_preserves_unowned_text_and_models() {
        let prefix = b"# another plugin\n- id: keep\n  config:\n    expression: !!js 'ctx.foo'\n";
        let mut req = input("deepseek-harness");
        let (first, _, _) = build("deepseek-harness", &req, Some(prefix)).unwrap();
        let mut with_suffix = first;
        with_suffix.extend_from_slice(b"# preserve trailing note\n- id: tail\n  disabled: true\n");
        req.model = "second: #model".into();
        let (second, exists, count) = build("deepseek-harness", &req, Some(&with_suffix)).unwrap();
        assert!(exists);
        assert_eq!(count, 2);
        assert!(second.starts_with(prefix));
        assert!(String::from_utf8_lossy(&second)
            .ends_with("# preserve trailing note\n- id: tail\n  disabled: true\n"));
        let (_, _, block) = harness_parts(Some(&second)).unwrap();
        let doc = harness_doc(block).unwrap();
        assert_eq!(
            doc[0]["insert"][0]["config"]["providers"]["hrouter"]["models"][1]["id"],
            "second: #model"
        );
    }
    #[test]
    fn non_model_files_and_other_providers_are_untouched() {
        let (dir, path) = temp_path("models.json");
        let auth = dir.path().join("auth.json");
        let session = dir.path().join("session.jsonl");
        std::fs::write(&auth, "secret auth fixture").unwrap();
        std::fs::write(&session, "conversation fixture").unwrap();
        let req = input("pi");
        let before = br#"{"providers":{"other":{"apiKey":"secret","models":[{"id":"old"}]}}}"#;
        std::fs::write(&path, before).unwrap();
        let (p, _, _) = review("pi", &path, &req).unwrap();
        apply_at("pi", &path, &req, &p.fingerprint).unwrap();
        assert_eq!(
            std::fs::read_to_string(auth).unwrap(),
            "secret auth fixture"
        );
        assert_eq!(
            std::fs::read_to_string(session).unwrap(),
            "conversation fixture"
        );
        let doc = json_doc(Some(&std::fs::read(path).unwrap())).unwrap();
        assert_eq!(doc["providers"]["other"]["apiKey"], "secret");
    }
    #[test]
    #[cfg(unix)]
    fn symlinks_and_oversized_files_are_readonly_failures() {
        let (dir, path) = temp_path("models.json");
        let target = dir.path().canonicalize().unwrap().join("real.json");
        std::fs::write(&target, "{}").unwrap();
        std::os::unix::fs::symlink(&target, &path).unwrap();
        assert!(inspect_at("workbuddy", &path).is_err());
        assert!(review("workbuddy", &path, &input("workbuddy")).is_err());
        assert_eq!(std::fs::read_to_string(target).unwrap(), "{}");
        let big = dir.path().canonicalize().unwrap().join("large");
        std::fs::write(&big, vec![b' '; 2 * 1024 * 1024 + 1]).unwrap();
        assert!(inspect_at("workbuddy", &big).is_err());
    }
}
