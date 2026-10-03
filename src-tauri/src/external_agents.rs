//! File-backed client adapters. No proxy or session migration.
//! Pi schema: earendil-works/pi packages/coding-agent/docs/models.md (2026-10-01).
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub(super) static PI_WRITE_LOCK: Mutex<()> = Mutex::new(());
const MAX_CONFIG_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PiConnection {
    pub base_url: String,
    pub model: String,
    pub api: String,
    pub credential_mode: String,
    pub credential: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PiPreview {
    pub path: String,
    pub fingerprint: String,
    pub existed: bool,
    pub updating_provider: bool,
    pub model_count: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PiApplied {
    pub path: String,
    pub backup_path: Option<String>,
}

pub(super) fn pi_path() -> Result<PathBuf, String> {
    let home = crate::config::get_home_dir();
    let home = home.canonicalize().unwrap_or(home);
    // Tests and the isolated preview must never inherit the user's real Pi override.
    let root = if std::env::var_os("CC_SWITCH_TEST_HOME").is_some() {
        home.join(".pi/agent")
    } else if let Some(value) = std::env::var_os("PI_CODING_AGENT_DIR") {
        let s = value.to_string_lossy();
        if let Some(tail) = s.strip_prefix("~/") {
            home.join(tail)
        } else {
            PathBuf::from(value)
        }
    } else {
        home.join(".pi/agent")
    };
    if !root.is_absolute() {
        return Err("Pi agent directory must be absolute".into());
    }
    Ok(root.join("models.json"))
}
fn check_path(path: &Path) -> Result<(), String> {
    // Refuse symlinks, including parent directory aliases, instead of modifying another target.
    for item in path.ancestors() {
        match fs::symlink_metadata(item) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(
                    "Agent configuration uses a symbolic link; edit the target file directly"
                        .into(),
                )
            }
            Ok(meta) if item == path && !meta.is_file() => {
                return Err("Configuration path is not a regular file".into())
            }
            Ok(_) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(format!("Cannot inspect Agent configuration: {e}")),
        }
    }
    Ok(())
}
pub(super) fn read(path: &Path) -> Result<Option<Vec<u8>>, String> {
    check_path(path)?;
    match fs::metadata(path) {
        Ok(meta) if meta.len() > MAX_CONFIG_BYTES => {
            Err("Agent configuration is too large to edit safely".into())
        }
        Ok(_) => fs::read(path)
            .map(Some)
            .map_err(|e| format!("Cannot read Agent configuration: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Cannot read Agent configuration: {e}")),
    }
}
fn validate(input: &PiConnection) -> Result<(), String> {
    let url = url::Url::parse(input.base_url.trim()).map_err(|_| "Invalid service URL")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Use an HTTP(S) base URL without credentials, query, or fragment".into());
    }
    if !matches!(
        input.api.as_str(),
        "openai-completions" | "openai-responses" | "anthropic-messages"
    ) {
        return Err("Unsupported Pi protocol".into());
    }
    if input.model.trim().is_empty()
        || input.model.len() > 256
        || input.model.chars().any(char::is_control)
    {
        return Err("Invalid model ID".into());
    }
    if input.credential_mode == "keep" {
        return Ok(());
    }
    let key = input.credential.trim();
    if key.is_empty() || key.len() > 8192 || key.chars().any(char::is_control) {
        return Err("Invalid credential".into());
    }
    match input.credential_mode.as_str() {
        "env"
            if key.chars().enumerate().all(|(i, c)| {
                c == '_' || c.is_ascii_alphabetic() || (i > 0 && c.is_ascii_digit())
            }) => {}
        "literal" if !key.starts_with('!') && !key.contains('$') => (),
        _ => {
            return Err(
                "Use a valid environment variable or a literal key, not a command/interpolation"
                    .into(),
            )
        }
    }
    Ok(())
}
pub(super) fn merged(
    input: &PiConnection,
    before: Option<&[u8]>,
) -> Result<(Value, bool, usize), String> {
    validate(input)?;
    let mut doc: Value = match before {
        Some(bytes) => serde_json::from_slice(bytes)
            .map_err(|_| "Invalid Pi JSON; existing file was not changed")?,
        None => json!({}),
    };
    let root = doc
        .as_object_mut()
        .ok_or("Agent configuration must be a JSON object")?;
    let providers = root
        .entry("providers")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("Pi providers must be an object")?;
    let updating = providers.contains_key("hrouter");
    let entry = providers
        .entry("hrouter")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("Existing hrouter provider must be an object")?;
    entry.insert(
        "baseUrl".into(),
        json!(input.base_url.trim().trim_end_matches('/')),
    );
    entry.insert("api".into(), json!(input.api));
    let key = if input.credential_mode == "env" {
        format!("${{{}}}", input.credential.trim())
    } else {
        input.credential.trim().to_owned()
    };
    if input.credential_mode == "keep" {
        if !entry
            .get("apiKey")
            .is_some_and(|v| v.is_string() && !v.as_str().unwrap().is_empty())
        {
            return Err("No saved credential; enter an API key or environment variable".into());
        }
    } else {
        entry.insert("apiKey".into(), json!(key));
    }
    let models = entry
        .entry("models")
        .or_insert_with(|| json!([]))
        .as_array_mut()
        .ok_or("Existing Pi models must be an array")?;
    if models
        .iter()
        .any(|m| !m.is_object() || !m.get("id").is_some_and(Value::is_string))
    {
        return Err("Existing Pi model entries are invalid; refusing to overwrite".into());
    }
    if !models.iter().any(|m| m["id"] == input.model.trim()) {
        models.push(json!({"id":input.model.trim()}));
    }
    let count = models.len();
    Ok((doc, updating, count))
}
fn review(
    path: &Path,
    input: &PiConnection,
) -> Result<(PiPreview, Value, Option<Vec<u8>>), String> {
    let before = read(path)?;
    let (doc, updating_provider, model_count) = merged(input, before.as_deref())?;
    let mut hash = Sha256::new();
    hash.update(path.to_string_lossy().as_bytes());
    hash.update([u8::from(before.is_some())]);
    if let Some(bytes) = &before {
        hash.update(bytes);
    }
    hash.update(serde_json::to_vec(input).map_err(|_| "Could not prepare configuration")?);
    Ok((
        PiPreview {
            path: path.display().to_string(),
            fingerprint: format!("{:x}", hash.finalize()),
            existed: before.is_some(),
            updating_provider,
            model_count,
        },
        doc,
        before,
    ))
}
pub(super) fn private_atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid configuration path")?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Cannot create configuration directory: {e}"))?;
    check_path(path)?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Cannot prepare configuration file: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        tmp.as_file()
            .set_permissions(fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Cannot protect configuration file: {e}"))?;
    }
    tmp.write_all(bytes)
        .and_then(|_| tmp.as_file().sync_all())
        .map_err(|e| format!("Cannot write configuration file: {e}"))?;
    tmp.persist(path)
        .map_err(|e| format!("Cannot replace configuration file: {}", e.error))?;
    Ok(())
}
fn apply_at(path: &Path, input: &PiConnection, fingerprint: &str) -> Result<PiApplied, String> {
    let _lock = PI_WRITE_LOCK
        .lock()
        .map_err(|_| "Agent configuration is busy")?;
    let (preview, doc, before) = review(path, input)?;
    if preview.fingerprint != fingerprint {
        return Err("Agent configuration changed after preview; preview again".into());
    }
    let backup_path = if let Some(bytes) = &before {
        let backup = path
            .parent()
            .unwrap()
            .join("hrouter-backups")
            .join(format!("models-{}.json", uuid::Uuid::new_v4()));
        private_atomic_write(&backup, bytes)?;
        Some(backup.display().to_string())
    } else {
        None
    };
    // Recheck after backup; Pi may have written while the preview was open.
    if read(path)? != before {
        return Err("Agent configuration changed during backup; preview again".into());
    }
    let mut bytes =
        serde_json::to_vec_pretty(&doc).map_err(|_| "Could not encode Agent configuration")?;
    bytes.push(b'\n');
    private_atomic_write(path, &bytes)?;
    Ok(PiApplied {
        path: preview.path,
        backup_path,
    })
}
#[tauri::command]
pub fn preview_pi_connection(input: PiConnection) -> Result<PiPreview, String> {
    Ok(review(&pi_path()?, &input)?.0)
}
#[tauri::command]
pub fn apply_pi_connection(input: PiConnection, fingerprint: String) -> Result<PiApplied, String> {
    apply_at(&pi_path()?, &input, &fingerprint)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input() -> PiConnection {
        PiConnection {
            base_url: "https://relay.example/v1".into(),
            model: "test-model".into(),
            api: "openai-completions".into(),
            credential_mode: "env".into(),
            credential: "HROUTER_API_KEY".into(),
        }
    }
    #[test]
    fn merges_without_touching_other_providers_or_model_metadata() {
        let original = json!({"extra":true,"providers":{"other":{"apiKey":"secret"},"hrouter":{"headers":{"x-custom":"keep"},"models":[{"id":"test-model","contextWindow":12345},{"id":"other-model"}]}}});
        let (doc, exists, count) =
            merged(&input(), Some(&serde_json::to_vec(&original).unwrap())).unwrap();
        assert!(exists);
        assert_eq!(count, 2);
        assert_eq!(doc["extra"], true);
        assert_eq!(doc["providers"]["other"], original["providers"]["other"]);
        assert_eq!(
            doc["providers"]["hrouter"]["models"],
            original["providers"]["hrouter"]["models"]
        );
        assert_eq!(doc["providers"]["hrouter"]["apiKey"], "${HROUTER_API_KEY}");
    }
    #[test]
    fn invalid_json_and_shapes_are_not_overwritten() {
        for text in [
            "{bad",
            "[]",
            r#"{"providers":[]}"#,
            r#"{"providers":{"hrouter":{"models":{}}}}"#,
        ] {
            assert!(merged(&input(), Some(text.as_bytes())).is_err());
        }
    }
    #[test]
    fn rejects_commands_bad_urls_and_protocols() {
        for bad in ["!curl example.com", "${SECRET}", "bad\nkey"] {
            let mut i = input();
            i.credential_mode = "literal".into();
            i.credential = bad.into();
            assert!(validate(&i).is_err());
        }
        for url in [
            "file:///tmp/config",
            "https://user:pass@example.com",
            "https://example.com?key=secret",
        ] {
            let mut i = input();
            i.base_url = url.into();
            assert!(validate(&i).is_err());
        }
        let mut i = input();
        i.api = "invented".into();
        assert!(validate(&i).is_err());
    }
    #[test]
    fn preview_is_readonly_and_apply_creates_private_file() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp
            .path()
            .canonicalize()
            .unwrap()
            .join("agent/models.json");
        let (p, _, _) = review(&path, &input()).unwrap();
        assert!(!path.exists());
        assert!(!serde_json::to_string(&p)
            .unwrap()
            .contains("HROUTER_API_KEY"));
        apply_at(&path, &input(), &p.fingerprint).unwrap();
        assert!(path.is_file());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }
    #[test]
    fn stale_file_or_form_refuses_write() {
        let t = tempfile::tempdir().unwrap();
        let path = t.path().canonicalize().unwrap().join("models.json");
        fs::write(&path, "{}").unwrap();
        let (p, _, _) = review(&path, &input()).unwrap();
        fs::write(&path, "{\"new\":true}").unwrap();
        assert!(apply_at(&path, &input(), &p.fingerprint).is_err());
        let (p, _, _) = review(&path, &input()).unwrap();
        let mut changed = input();
        changed.model = "another".into();
        assert!(apply_at(&path, &changed, &p.fingerprint).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "{\"new\":true}");
    }
    #[test]
    fn original_bytes_are_backed_up_and_sessions_untouched() {
        let t = tempfile::tempdir().unwrap();
        let path = t.path().canonicalize().unwrap().join("models.json");
        let bytes = b"{\"keep\": 123}\n";
        fs::write(&path, bytes).unwrap();
        fs::write(
            t.path().canonicalize().unwrap().join("session.jsonl"),
            "original conversation",
        )
        .unwrap();
        let (p, _, _) = review(&path, &input()).unwrap();
        let result = apply_at(&path, &input(), &p.fingerprint).unwrap();
        assert_eq!(fs::read(result.backup_path.unwrap()).unwrap(), bytes);
        assert_eq!(
            fs::read_to_string(t.path().canonicalize().unwrap().join("session.jsonl")).unwrap(),
            "original conversation"
        );
    }
    #[test]
    #[cfg(unix)]
    fn refuses_symlinks() {
        use std::os::unix::fs::symlink;
        let t = tempfile::tempdir().unwrap();
        let target = t.path().canonicalize().unwrap().join("actual.json");
        fs::write(&target, "{}").unwrap();
        let path = t.path().canonicalize().unwrap().join("models.json");
        symlink(&target, &path).unwrap();
        assert!(review(&path, &input()).is_err());
        assert_eq!(fs::read_to_string(target).unwrap(), "{}");
    }
}
