//! Device-local snapshots for direct Claude/Codex switches. Credentials never leave the backend.
use crate::{app_config::AppType, database::Database, error::AppError, store::AppState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, path::PathBuf};

pub fn supported(app: &AppType) -> bool {
    matches!(app, AppType::Claude | AppType::Codex)
}

// Local file: cloud database restores must not enable/disable protection on this computer.
fn preference_path(app: &AppType) -> PathBuf {
    crate::config::get_app_config_dir().join(format!("protect-{}.json", app.as_str()))
}
pub fn enabled(app: &AppType) -> bool {
    supported(app)
        && (providers_only_sync()
            || std::fs::read_to_string(preference_path(app))
                .map(|s| s.trim() == "true")
                .unwrap_or(false))
}
pub fn lite_mode() -> bool {
    std::fs::read_to_string(crate::config::get_app_config_dir().join("lite-mode.json"))
        .map(|s| s.trim() == "true")
        .unwrap_or(false)
}
pub fn set_lite_mode(enabled: bool) -> Result<(), AppError> {
    crate::config::write_text_file(
        &crate::config::get_app_config_dir().join("lite-mode.json"),
        if enabled { "true" } else { "false" },
    )
}
pub fn require_full_mode() -> Result<(), AppError> {
    if lite_mode() {
        return Err(AppError::Message(
            "Lite 模式已停用配置扩展管理；请先在接入工作台关闭 Lite 模式。".into(),
        ));
    }
    Ok(())
}
pub fn set_enabled(app: &AppType, value: bool) -> Result<(), AppError> {
    if !supported(app) {
        return Err(AppError::Message(
            "配置保护目前支持 Claude Code 和 Codex。".into(),
        ));
    }
    crate::config::write_text_file(&preference_path(app), if value { "true" } else { "false" })
}

pub fn prompts_protected(app: &AppType) -> bool {
    lite_mode()
        || std::fs::read_to_string(
            crate::config::get_app_config_dir()
                .join(format!("protect-prompts-{}.json", app.as_str())),
        )
        .map(|s| s.trim() == "true")
        .unwrap_or(false)
}

pub fn set_prompts_protected(app: &AppType, value: bool) -> Result<(), AppError> {
    crate::config::write_text_file(
        &crate::config::get_app_config_dir().join(format!("protect-prompts-{}.json", app.as_str())),
        if value { "true" } else { "false" },
    )
}

pub fn require_prompt_management(app: &AppType) -> Result<(), AppError> {
    if prompts_protected(app) {
        return Err(AppError::Message("本机已关闭提示词管理，未读取、覆盖或清空本地规则文件。可在接入工作台的配置保护中更改。".into()));
    }
    Ok(())
}

pub fn providers_only_sync() -> bool {
    lite_mode()
        || std::fs::read_to_string(
            crate::config::get_app_config_dir().join("providers-only-sync.json"),
        )
        .map(|s| s.trim() == "true")
        .unwrap_or(false)
}
pub fn set_providers_only_sync(enabled: bool) -> Result<(), AppError> {
    crate::config::write_text_file(
        &crate::config::get_app_config_dir().join("providers-only-sync.json"),
        if enabled { "true" } else { "false" },
    )
}

fn paths(app: &AppType) -> Vec<PathBuf> {
    match app {
        AppType::Claude => vec![crate::config::get_claude_settings_path()],
        AppType::Codex => vec![
            crate::codex_config::get_codex_config_path(),
            crate::codex_config::get_codex_auth_path(),
            crate::codex_config::get_codex_model_catalog_path(),
        ],
        _ => vec![],
    }
}
fn read_files(app: &AppType) -> Result<Vec<Option<String>>, AppError> {
    paths(app)
        .into_iter()
        .map(|p| match std::fs::read_to_string(&p) {
            Ok(s) => Ok(Some(s)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(AppError::io(&p, e)),
        })
        .collect()
}
fn fingerprint(app: &AppType, files: &[Option<String>]) -> String {
    let mut hash = Sha256::new();
    for p in paths(app) {
        hash.update(p.to_string_lossy().as_bytes());
        hash.update([0]);
    }
    hash.update(serde_json::to_vec(files).unwrap_or_default());
    format!("{:x}", hash.finalize())
}

pub fn preserve_claude(live: &Value, target: &Value) -> Result<Value, AppError> {
    if !live.is_object() || !target.is_object() {
        return Err(AppError::Config("Claude 配置必须为 JSON 对象。".into()));
    }
    if target.get("env").is_some_and(|env| !env.is_object()) {
        return Err(AppError::Config("目标 Claude env 必须为对象。".into()));
    }
    let mut result = live.clone();
    let env = result
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert(json!({}));
    let env = env
        .as_object_mut()
        .ok_or_else(|| AppError::Config("Claude env 必须为对象。".into()))?;
    // Deliberately narrow ownership. Hooks, permissions, MCP and arbitrary env stay local.
    let owned = |key: &str| {
        matches!(
            key,
            "ANTHROPIC_API_KEY"
                | "ANTHROPIC_AUTH_TOKEN"
                | "ANTHROPIC_BASE_URL"
                | "ANTHROPIC_MODEL"
                | "ANTHROPIC_SMALL_FAST_MODEL"
                | "ANTHROPIC_DEFAULT_HAIKU_MODEL"
                | "ANTHROPIC_DEFAULT_SONNET_MODEL"
                | "ANTHROPIC_DEFAULT_OPUS_MODEL"
        )
    };
    env.retain(|k, _| !owned(k));
    if let Some(source) = target.get("env").and_then(Value::as_object) {
        for (k, v) in source {
            if owned(k) {
                env.insert(k.clone(), v.clone());
            }
        }
    }
    if let Some(model) = target.get("model") {
        result["model"] = model.clone();
    } else {
        result.as_object_mut().unwrap().remove("model");
    }
    Ok(result)
}

pub fn preserve_codex(live: &str, target: &str) -> Result<String, AppError> {
    let mut live = live
        .parse::<toml_edit::DocumentMut>()
        .map_err(|_| AppError::Config("现有 Codex TOML 无效，已停止写入。".into()))?;
    let target = target
        .parse::<toml_edit::DocumentMut>()
        .map_err(|_| AppError::Config("目标 Codex TOML 无效。".into()))?;
    for key in [
        "model",
        "model_provider",
        "model_reasoning_effort",
        "model_reasoning_summary",
        "model_verbosity",
        "experimental_bearer_token",
        "wire_api",
        "model_catalog_json",
        "model_context_window",
        "model_auto_compact_token_limit",
    ] {
        if let Some(value) = target.get(key) {
            live[key] = value.clone();
        } else {
            live.remove(key);
        }
    }
    // Keep old definitions so existing sessions can still resolve their provider.
    if let Some(id) = target.get("model_provider").and_then(|i| i.as_str()) {
        if let Some(provider) = target.get("model_providers").and_then(|i| i.get(id)) {
            if live.get("model_providers").is_none() {
                live["model_providers"] = toml_edit::Item::Table(toml_edit::Table::new());
            }
            let table = live["model_providers"]
                .as_table_like_mut()
                .ok_or_else(|| AppError::Config("model_providers 必须为表。".into()))?;
            table.insert(id, provider.clone());
        }
    }
    if let Some(value) = target
        .get("features")
        .and_then(|i| i.get("api_key_model_discovery"))
    {
        if live.get("features").is_none() {
            live["features"] = toml_edit::Item::Table(toml_edit::Table::new());
        }
        let table = live["features"]
            .as_table_like_mut()
            .ok_or_else(|| AppError::Config("features 必须为表。".into()))?;
        table.insert("api_key_model_discovery", value.clone());
    } else if let Some(table) = live.get_mut("features").and_then(|i| i.as_table_like_mut()) {
        table.remove("api_key_model_discovery");
    }
    Ok(live.to_string())
}

pub fn protect_settings(app: &AppType, target: Value) -> Result<Value, AppError> {
    if !enabled(app) {
        return Ok(target);
    }
    let files = read_files(app)?;
    match app {
        AppType::Claude => {
            let live: Value = serde_json::from_str(files[0].as_deref().unwrap_or("{}"))
                .map_err(|_| AppError::Config("现有 Claude JSON 无效，已停止写入。".into()))?;
            preserve_claude(&live, &target)
        }
        AppType::Codex => {
            let mut result = target;
            let merged = preserve_codex(
                files[0].as_deref().unwrap_or(""),
                result.get("config").and_then(Value::as_str).unwrap_or(""),
            )?;
            result["config"] = Value::String(merged);
            Ok(result)
        }
        _ => Ok(target),
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub app: String,
    pub created_at: i64,
    pub previous_provider: Option<String>,
    pub next_provider: Option<String>,
    before: Vec<Option<String>>,
    before_hash: String,
    after_hash: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub id: String,
    pub created_at: i64,
    pub previous_provider: Option<String>,
    pub next_provider: Option<String>,
    pub can_restore: bool,
}
fn snapshot_dir(app: &AppType) -> PathBuf {
    crate::config::get_app_config_dir()
        .join("switch-snapshots")
        .join(app.as_str())
}
fn snapshot_path(app: &AppType, id: &str) -> Result<PathBuf, AppError> {
    uuid::Uuid::parse_str(id).map_err(|_| AppError::Message("快照 ID 无效。".into()))?;
    Ok(snapshot_dir(app).join(format!("{id}.json")))
}
fn save(app: &AppType, snapshot: &Snapshot) -> Result<(), AppError> {
    let path = snapshot_path(app, &snapshot.id)?;
    let directory = snapshot_dir(app);
    std::fs::create_dir_all(&directory).map_err(|e| AppError::io(&directory, e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // Protect the directory before atomic_write creates temporary files containing keys.
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| AppError::io(&directory, e))?;
    }
    crate::config::write_json_file(&path, snapshot)?;
    Ok(())
}
pub fn begin(state: &AppState, app: &AppType, id: &str) -> Result<Option<Snapshot>, AppError> {
    if !enabled(app) {
        return Ok(None);
    }
    let files = read_files(app)?;
    let snapshot = Snapshot {
        id: uuid::Uuid::new_v4().to_string(),
        app: app.as_str().into(),
        created_at: chrono::Utc::now().timestamp_millis(),
        previous_provider: crate::settings::get_effective_current_provider(&state.db, app)?,
        next_provider: Some(id.into()),
        before_hash: fingerprint(app, &files),
        before: files,
        after_hash: None,
    };
    save(app, &snapshot)?; // A failed backup must stop the switch.
    Ok(Some(snapshot))
}
fn write_files(app: &AppType, files: &[Option<String>]) -> Result<(), AppError> {
    let targets = paths(app);
    if targets.len() != files.len() {
        return Err(AppError::Message("快照文件数量不匹配。".into()));
    }
    for (path, content) in targets.iter().zip(files) {
        if let Some(text) = content {
            crate::config::write_text_file(path, text)?;
        } else if path.exists() {
            std::fs::remove_file(path).map_err(|e| AppError::io(path, e))?;
        }
    }
    Ok(())
}
fn restore_identity(state: &AppState, app: &AppType, id: Option<&str>) -> Result<(), AppError> {
    crate::settings::set_current_provider(app, id)?;
    if let Some(id) = id {
        state.db.set_current_provider(app.as_str(), id)?;
    } else {
        state.db.set_current_provider(app.as_str(), "")?;
    }
    Ok(())
}
pub fn finish(
    state: &AppState,
    app: &AppType,
    snapshot: Option<Snapshot>,
    result: Result<crate::services::SwitchResult, AppError>,
) -> Result<crate::services::SwitchResult, AppError> {
    let Some(mut snapshot) = snapshot else {
        return result;
    };
    if let Err(original) = result {
        write_files(app, &snapshot.before)
            .and_then(|_| restore_identity(state, app, snapshot.previous_provider.as_deref()))
            .map_err(|e| {
                AppError::Message(format!(
                    "切换失败：{original}；自动恢复失败：{e}；原配置已保存在本地快照。"
                ))
            })?;
        return Err(original);
    }
    let mut result = result?;
    let persisted = read_files(app).and_then(|files| {
        snapshot.after_hash = Some(fingerprint(app, &files));
        save(app, &snapshot)
    });
    if persisted.is_err() {
        result.warnings.push("snapshot_after_write_failed".into());
    }
    Ok(result)
}

pub fn list(app: &AppType) -> Result<Vec<SnapshotSummary>, AppError> {
    let current = fingerprint(app, &read_files(app)?);
    let directory = snapshot_dir(app);
    if !directory.exists() {
        return Ok(vec![]);
    }
    let mut result = vec![];
    for entry in std::fs::read_dir(&directory).map_err(|e| AppError::io(&directory, e))? {
        let entry = entry.map_err(|e| AppError::io(&directory, e))?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let snapshot: Snapshot = serde_json::from_slice(
            &std::fs::read(entry.path()).map_err(|e| AppError::io(entry.path(), e))?,
        )
        .map_err(|e| AppError::Message(e.to_string()))?;
        result.push(SnapshotSummary {
            id: snapshot.id,
            created_at: snapshot.created_at,
            previous_provider: snapshot.previous_provider,
            next_provider: snapshot.next_provider,
            can_restore: snapshot.after_hash.as_deref() == Some(&current),
        });
    }
    result.sort_by_key(|s| std::cmp::Reverse(s.created_at));
    result.truncate(30);
    Ok(result)
}

pub fn restore(state: &AppState, app: &AppType, id: &str) -> Result<(), AppError> {
    if !supported(app) {
        return Err(AppError::Message("不支持此应用的快照。".into()));
    }
    let _guard = futures::executor::block_on(state.proxy_service.lock_switch_for_app(app.as_str()));
    if futures::executor::block_on(state.db.get_live_backup(app.as_str()))?.is_some()
        || state
            .proxy_service
            .detect_takeover_in_live_config_for_app(app)
    {
        return Err(AppError::Message(
            "请先关闭该应用的本地路由，再恢复直连配置。".into(),
        ));
    }
    let path = snapshot_path(app, id)?;
    let snapshot: Snapshot =
        serde_json::from_slice(&std::fs::read(&path).map_err(|e| AppError::io(&path, e))?)
            .map_err(|e| AppError::Message(e.to_string()))?;
    let current = read_files(app)?;
    if snapshot.app != app.as_str()
        || snapshot.after_hash.as_deref() != Some(&fingerprint(app, &current))
        || snapshot.before_hash != fingerprint(app, &snapshot.before)
    {
        return Err(AppError::Message(
            "配置或目录已在切换后发生变化，拒绝覆盖。请先备份并手动核对。".into(),
        ));
    }
    if let Some(previous) = &snapshot.previous_provider {
        if state
            .db
            .get_provider_by_id(previous, app.as_str())?
            .is_none()
        {
            return Err(AppError::Message("原供应商已删除，无法安全恢复。".into()));
        }
    }
    let current_id = crate::settings::get_effective_current_provider(&state.db, app)?;
    if let Err(e) = write_files(app, &snapshot.before)
        .and_then(|_| restore_identity(state, app, snapshot.previous_provider.as_deref()))
    {
        write_files(app, &current)
            .and_then(|_| restore_identity(state, app, current_id.as_deref()))?;
        return Err(e);
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchPreview {
    pub fingerprint: String,
    pub protected: bool,
    pub fields: Vec<String>,
    pub files: Vec<String>,
}
pub fn preview(db: &Database, app: &AppType, id: &str) -> Result<SwitchPreview, AppError> {
    if !supported(app) {
        return Err(AppError::Message(
            "配置预览目前支持 Claude Code 和 Codex。".into(),
        ));
    }
    let provider = db
        .get_provider_by_id(id, app.as_str())?
        .ok_or_else(|| AppError::Message("供应商不存在。".into()))?;
    let files = read_files(app)?;
    let effective =
        crate::services::provider::build_effective_settings_with_common_config(db, app, &provider)?;
    let target = protect_settings(app, effective)?;
    let mut review_hash = Sha256::new();
    review_hash.update(fingerprint(app, &files));
    review_hash.update(serde_json::to_vec(&target).map_err(|e| AppError::Message(e.to_string()))?);
    review_hash.update([u8::from(enabled(app))]);
    let review_fingerprint = format!("{:x}", review_hash.finalize());
    let mut fields = BTreeSet::new();
    if matches!(app, AppType::Claude) {
        let before: Value = serde_json::from_str(files[0].as_deref().unwrap_or("{}"))
            .map_err(|e| AppError::Message(e.to_string()))?;
        let after = target;
        fn diff(a: &Value, b: &Value, prefix: &str, out: &mut BTreeSet<String>) {
            if a == b {
                return;
            }
            if let (Some(a), Some(b)) = (a.as_object(), b.as_object()) {
                for key in a.keys().chain(b.keys()).collect::<BTreeSet<_>>() {
                    diff(
                        a.get(key).unwrap_or(&Value::Null),
                        b.get(key).unwrap_or(&Value::Null),
                        &format!("{prefix}/{key}"),
                        out,
                    );
                }
            } else {
                out.insert(prefix.to_string());
            }
        }
        diff(&before, &after, "", &mut fields);
    } else {
        let before = files[0]
            .as_deref()
            .unwrap_or("")
            .parse::<toml_edit::DocumentMut>()
            .map_err(|e| AppError::Message(e.to_string()))?;
        let after = target["config"]
            .as_str()
            .unwrap_or("")
            .parse::<toml_edit::DocumentMut>()
            .map_err(|e| AppError::Message(e.to_string()))?;
        for key in before
            .iter()
            .map(|(k, _)| k)
            .chain(after.iter().map(|(k, _)| k))
            .collect::<BTreeSet<_>>()
        {
            if before.get(key).map(ToString::to_string) != after.get(key).map(ToString::to_string) {
                fields.insert(key.to_string());
            }
        }
        fields.insert("auth.json（认证按所选供应商更新）".into());
    }
    Ok(SwitchPreview {
        fingerprint: review_fingerprint,
        protected: enabled(app),
        fields: fields.into_iter().collect(),
        files: paths(app).iter().map(|p| p.display().to_string()).collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[serial_test::serial]
    fn lite_switch_does_not_backfill_or_replace_user_configuration() {
        let _home = TestHome::new();
        let db = std::sync::Arc::new(Database::memory().unwrap());
        let state = AppState::new(db.clone());
        let old = crate::provider::Provider::with_id(
            "old".into(),
            "old".into(),
            json!({"env":{"ANTHROPIC_API_KEY":"old"}}),
            None,
        );
        db.save_provider("claude", &old).unwrap();
        db.save_provider("claude",&crate::provider::Provider::with_id("new".into(),"new".into(),json!({"env":{"ANTHROPIC_API_KEY":"new","ANTHROPIC_LOG":"foreign"},"hooks":{"foreign":true}}),None)).unwrap();
        db.set_current_provider("claude", "old").unwrap();
        crate::settings::set_current_provider(&AppType::Claude, Some("old")).unwrap();
        let local = json!({"env":{"ANTHROPIC_API_KEY":"old","CUSTOM":"keep","ANTHROPIC_LOG":"keep"},"hooks":{"local":true},"permissions":{"allow":["Read"]}});
        crate::config::write_json_file(&crate::config::get_claude_settings_path(), &local).unwrap();
        db.set_config_snippet("claude", Some("{\"hooks\":{\"cloud\":true}}".into()))
            .unwrap();
        set_lite_mode(true).unwrap();
        crate::services::ProviderService::switch(&state, AppType::Claude, "new").unwrap();
        let actual: Value = serde_json::from_str(
            &std::fs::read_to_string(crate::config::get_claude_settings_path()).unwrap(),
        )
        .unwrap();
        assert_eq!(actual["hooks"], local["hooks"]);
        assert_eq!(actual["permissions"], local["permissions"]);
        assert_eq!(actual["env"]["ANTHROPIC_LOG"], "keep");
        assert_eq!(actual["env"]["ANTHROPIC_API_KEY"], "new");
        assert_eq!(
            db.get_provider_by_id("old", "claude")
                .unwrap()
                .unwrap()
                .settings_config,
            old.settings_config
        );
        assert_eq!(
            db.get_config_snippet("claude").unwrap().as_deref(),
            Some("{\"hooks\":{\"cloud\":true}}")
        );
    }

    #[test]
    #[serial_test::serial]
    fn independent_environment_apply_checks_preview_and_preserves_auth() {
        let _home = TestHome::new();
        let db = Database::memory().unwrap();
        let target_dir = tempfile::tempdir().unwrap();
        let config = target_dir.path().join("config.toml");
        let auth = target_dir.path().join("auth.json");
        std::fs::write(
            &config,
            "# target rules\n[mcp_servers.mine]\ncommand='mine'\n",
        )
        .unwrap();
        std::fs::write(&auth, "original login").unwrap();
        db.save_provider("codex",&crate::provider::Provider::with_id("p".into(),"p".into(),json!({"auth":{"OPENAI_API_KEY":"key"},"config":"model='m'\nmodel_provider='custom'\n[model_providers.custom]\nbase_url='https://example.test/v1'\nwire_api='responses'"}),None)).unwrap();
        let targets = vec![crate::environment_targets::EnvironmentTarget {
            name: "WSL fixture".into(),
            app: "codex".into(),
            directory: target_dir.path().to_string_lossy().into_owned(),
            provider_id: "p".into(),
        }];
        let stale = crate::environment_targets::preview(&db, &targets).unwrap();
        std::fs::write(
            &config,
            "# external edit\n[mcp_servers.mine]\ncommand='mine'\n",
        )
        .unwrap();
        assert!(crate::environment_targets::apply(&db, &targets, &stale.fingerprint).is_err());
        let preview = crate::environment_targets::preview(&db, &targets).unwrap();
        let backup =
            crate::environment_targets::apply(&db, &targets, &preview.fingerprint).unwrap();
        assert!(std::path::Path::new(&backup).is_file());
        let actual = std::fs::read_to_string(&config).unwrap();
        assert!(actual.contains("mcp_servers.mine"));
        assert!(actual.contains("# external edit"));
        assert!(actual.contains("requires_openai_auth = false"));
        assert_eq!(std::fs::read_to_string(auth).unwrap(), "original login");
        assert!(db.get_current_provider("codex").unwrap().is_none());
        let local_config = crate::codex_config::get_codex_config_path();
        crate::config::write_text_file(&local_config, "# local configuration\n").unwrap();
        let local_targets = vec![crate::environment_targets::EnvironmentTarget {
            directory: local_config
                .parent()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            ..targets[0].clone()
        }];
        let preview = crate::environment_targets::preview(&db, &local_targets).unwrap();
        crate::environment_targets::apply(&db, &local_targets, &preview.fingerprint).unwrap();
        assert_eq!(
            db.get_current_provider("codex").unwrap().as_deref(),
            Some("p")
        );
        assert_eq!(
            crate::settings::get_current_provider(&AppType::Codex).as_deref(),
            Some("p")
        );
    }
    #[test]
    #[serial_test::serial]
    fn lite_mode_and_provider_only_sync_preserve_rules_and_local_database() {
        let _home = TestHome::new();
        let remote = Database::memory().unwrap();
        let local = std::sync::Arc::new(Database::memory().unwrap());
        let state = AppState::new(local.clone());
        let app = AppType::Codex;
        let path = crate::prompt_files::prompt_file_path(&app).unwrap();
        crate::config::write_text_file(&path, "my independent rules").unwrap();
        let prompt = crate::prompt::Prompt {
            id: "p".into(),
            name: "remote".into(),
            content: "remote prompt must not upload".into(),
            description: None,
            enabled: true,
            created_at: None,
            updated_at: None,
        };
        remote.save_prompt("codex", &prompt).unwrap();
        local
            .save_prompt(
                "codex",
                &crate::prompt::Prompt {
                    content: "local prompt".into(),
                    ..prompt.clone()
                },
            )
            .unwrap();
        remote
            .save_provider(
                "codex",
                &crate::provider::Provider::with_id(
                    "remote".into(),
                    "Remote API".into(),
                    json!({"auth":{"OPENAI_API_KEY":"api"},"config":"model='m'"}),
                    None,
                ),
            )
            .unwrap();
        set_lite_mode(true).unwrap();
        assert!(enabled(&app));
        assert!(prompts_protected(&app));
        assert!(providers_only_sync());
        assert!(crate::services::PromptService::upsert_prompt(
            &state,
            app.clone(),
            "p",
            prompt.clone()
        )
        .is_err());
        assert!(crate::services::PromptService::enable_prompt(&state, app.clone(), "p").is_err());
        assert!(crate::services::SkillService::remove_from_app("test", &app).is_err());
        let snapshot = remote.export_sql_string_for_sync().unwrap();
        assert!(!snapshot.contains("remote prompt must not upload"));
        local.import_sql_string_for_sync(&snapshot).unwrap();
        assert!(local
            .get_provider_by_id("remote", "codex")
            .unwrap()
            .is_some());
        assert_eq!(
            local.get_prompts("codex").unwrap()["p"].content,
            "local prompt"
        );
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "my independent rules"
        );
        set_lite_mode(false).unwrap();
        assert!(!enabled(&app));
        set_prompts_protected(&app, true).unwrap();
        local
            .import_sql_string(&remote.export_sql_string().unwrap())
            .unwrap();
        assert!(prompts_protected(&app));
        assert!(crate::services::PromptService::enable_prompt(&state, app.clone(), "p").is_err());
        assert_eq!(
            std::fs::read_to_string(path).unwrap(),
            "my independent rules"
        );
    }
    #[test]
    fn claude_protection_preserves_user_fields_and_removes_old_credentials() {
        let live = json!({"hooks":{"Stop":[1]},"permissions":{"allow":["Read"]},"env":{"USER_SETTING":"keep","ANTHROPIC_AUTH_TOKEN":"old","ANTHROPIC_BASE_URL":"old"}});
        let target = json!({"hooks":{},"env":{"ANTHROPIC_API_KEY":"new"}});
        let merged = preserve_claude(&live, &target).unwrap();
        assert_eq!(merged["hooks"], live["hooks"]);
        assert_eq!(merged["permissions"], live["permissions"]);
        assert_eq!(merged["env"]["USER_SETTING"], "keep");
        assert!(merged["env"].get("ANTHROPIC_AUTH_TOKEN").is_none());
        assert_eq!(merged["env"]["ANTHROPIC_API_KEY"], "new");
    }
    #[test]
    fn codex_preserves_comments_mcp_and_old_provider_definitions() {
        let live = "# user comment\nmodel_provider = 'old'\n[model_providers.old]\nbase_url = 'https://old.test'\n[mcp_servers.mine]\ncommand = 'my-tool'\n";
        let merged = preserve_codex(live, "model='new-model'\nmodel_provider='new'\n[model_providers.new]\nbase_url='https://new.test'\n").unwrap();
        assert!(merged.contains("# user comment"));
        assert!(merged.contains("mcp_servers.mine"));
        assert!(merged.contains("model_providers.old"));
        assert!(merged.contains("model_providers.new"));
    }
    #[test]
    fn invalid_local_config_is_never_replaced() {
        assert!(preserve_codex("invalid = [", "model='new'").is_err());
        assert!(preserve_claude(&json!({"env":"invalid"}), &json!({})).is_err());
    }
    struct TestHome {
        _dir: tempfile::TempDir,
        previous: Option<std::ffi::OsString>,
    }
    impl TestHome {
        fn new() -> Self {
            let dir = tempfile::tempdir().unwrap();
            let previous = std::env::var_os("CC_SWITCH_TEST_HOME");
            std::env::set_var("CC_SWITCH_TEST_HOME", dir.path());
            crate::settings::reload_settings().unwrap();
            Self {
                _dir: dir,
                previous,
            }
        }
    }
    impl Drop for TestHome {
        fn drop(&mut self) {
            if let Some(value) = &self.previous {
                std::env::set_var("CC_SWITCH_TEST_HOME", value);
            } else {
                std::env::remove_var("CC_SWITCH_TEST_HOME");
            }
            let _ = crate::settings::reload_settings();
        }
    }
    #[test]
    #[serial_test::serial]
    fn protected_switch_roundtrip_refuses_external_edits_and_restores_identity() {
        let _home = TestHome::new();
        let db = std::sync::Arc::new(Database::memory().unwrap());
        let state = AppState::new(db.clone());
        let app = AppType::Claude;
        let old = crate::provider::Provider::with_id(
            "old".into(),
            "Old".into(),
            json!({"env":{"ANTHROPIC_API_KEY":"a","ANTHROPIC_BASE_URL":"https://old.test"}}),
            None,
        );
        let new = crate::provider::Provider::with_id(
            "new".into(),
            "New".into(),
            json!({"env":{"ANTHROPIC_API_KEY":"b","ANTHROPIC_BASE_URL":"https://new.test"}}),
            None,
        );
        db.save_provider("claude", &old).unwrap();
        db.save_provider("claude", &new).unwrap();
        db.set_current_provider("claude", "old").unwrap();
        crate::settings::set_current_provider(&app, Some("old")).unwrap();
        let original = "{\"hooks\":{\"Stop\":[1]},\"env\":{\"ANTHROPIC_API_KEY\":\"a\",\"ANTHROPIC_BASE_URL\":\"https://old.test\"}}";
        crate::config::write_text_file(&paths(&app)[0], original).unwrap();
        set_enabled(&app, true).unwrap();
        let review = preview(&db, &app, "new").unwrap();
        crate::services::ProviderService::switch_checked(
            &state,
            app.clone(),
            "new",
            Some(&review.fingerprint),
        )
        .unwrap();
        let history = list(&app).unwrap();
        assert_eq!(history.len(), 1);
        assert!(history[0].can_restore);
        let after = read_files(&app).unwrap();
        let live: Value = serde_json::from_str(after[0].as_ref().unwrap()).unwrap();
        assert_eq!(live["hooks"]["Stop"], json!([1]));
        assert_eq!(live["env"]["ANTHROPIC_API_KEY"], "b");
        crate::config::write_text_file(&paths(&app)[0], "{\"user_edit\":true}").unwrap();
        assert!(restore(&state, &app, &history[0].id).is_err());
        assert_eq!(
            read_files(&app).unwrap()[0].as_deref(),
            Some("{\"user_edit\":true}")
        );
        write_files(&app, &after).unwrap();
        restore(&state, &app, &history[0].id).unwrap();
        assert_eq!(read_files(&app).unwrap()[0].as_deref(), Some(original));
        assert_eq!(
            db.get_current_provider("claude").unwrap().as_deref(),
            Some("old")
        );
    }
    #[test]
    #[serial_test::serial]
    fn stale_preview_rejects_changed_target_without_writing_files() {
        let _home = TestHome::new();
        let db = std::sync::Arc::new(Database::memory().unwrap());
        let state = AppState::new(db.clone());
        let app = AppType::Claude;
        let mut provider = crate::provider::Provider::with_id(
            "p".into(),
            "Provider".into(),
            json!({"env":{"ANTHROPIC_API_KEY":"a","ANTHROPIC_BASE_URL":"https://a.test"}}),
            None,
        );
        db.save_provider("claude", &provider).unwrap();
        set_enabled(&app, true).unwrap();
        let review = preview(&db, &app, "p").unwrap();
        provider.settings_config["env"]["ANTHROPIC_API_KEY"] = json!("changed");
        db.save_provider("claude", &provider).unwrap();
        assert!(crate::services::ProviderService::switch_checked(
            &state,
            app.clone(),
            "p",
            Some(&review.fingerprint)
        )
        .is_err());
        assert_eq!(read_files(&app).unwrap(), vec![None]);
        assert!(list(&app).unwrap().is_empty());
    }
    #[test]
    #[serial_test::serial]
    fn codex_switch_preserves_mcp_and_restores_generated_catalog() {
        let _home = TestHome::new();
        let db = std::sync::Arc::new(Database::memory().unwrap());
        let state = AppState::new(db.clone());
        let app = AppType::Codex;
        let original = "# local settings\nmodel='old-model'\nmodel_provider='old'\n[model_providers.old]\nname='Old'\nbase_url='https://old.test/v1'\nwire_api='responses'\n[mcp_servers.user_tool]\ncommand='user-tool'\n";
        let target = "model='new-model'\nmodel_provider='new'\n[model_providers.new]\nname='New'\nbase_url='https://new.test/v1'\nwire_api='responses'\n";
        for (id, config) in [("old", original), ("new", target)] {
            db.save_provider(
                "codex",
                &crate::provider::Provider::with_id(
                    id.into(),
                    id.into(),
                    json!({"auth":{"OPENAI_API_KEY":id},"config":config}),
                    None,
                ),
            )
            .unwrap();
        }
        db.set_current_provider("codex", "old").unwrap();
        crate::settings::set_current_provider(&app, Some("old")).unwrap();
        crate::config::write_text_file(&paths(&app)[0], original).unwrap();
        crate::config::write_text_file(&paths(&app)[1], "{\"OPENAI_API_KEY\":\"old\"}").unwrap();
        crate::config::write_text_file(&paths(&app)[2], "{\"marker\":\"original catalog\"}")
            .unwrap();
        let before = read_files(&app).unwrap();
        set_enabled(&app, true).unwrap();
        crate::services::ProviderService::switch(&state, app.clone(), "new").unwrap();
        let after = read_files(&app).unwrap();
        assert!(after[0].as_ref().unwrap().contains("mcp_servers.user_tool"));
        let history = list(&app).unwrap();
        assert!(history[0].can_restore);
        restore(&state, &app, &history[0].id).unwrap();
        assert_eq!(read_files(&app).unwrap(), before);
        let mut invalid = db.get_provider_by_id("new", "codex").unwrap().unwrap();
        invalid.settings_config["config"] = json!("broken = [");
        db.save_provider("codex", &invalid).unwrap();
        assert!(crate::services::ProviderService::switch(&state, app.clone(), "new").is_err());
        assert_eq!(read_files(&app).unwrap(), before);
        assert_eq!(
            db.get_current_provider("codex").unwrap().as_deref(),
            Some("old")
        );
    }
}
