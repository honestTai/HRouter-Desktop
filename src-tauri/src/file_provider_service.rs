//! File-backed provider drivers behind the existing provider CRUD/switch commands.
use crate::{
    agent_configs as files,
    external_agents::{self as io, PiConnection},
    provider::Provider,
    services::SwitchResult,
    store::AppState,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, sync::Mutex};
static OPERATIONS: Mutex<()> = Mutex::new(());
const ENV_KEY: &str = "HROUTER_MANAGED_API_KEY";
const ENV_BEGIN: &str = "# HRouter managed credential begin";
const ENV_END: &str = "# HRouter managed credential end";
pub fn supports(app: &str) -> bool {
    matches!(app, "pi" | "deepseek-harness" | "workbuddy")
}
fn connection(provider: &Provider) -> Result<PiConnection, String> {
    serde_json::from_value(provider.settings_config.clone())
        .map_err(|_| "供应商配置缺少有效的服务地址、模型或凭据字段".into())
}
fn env_patch(before: Option<&[u8]>, key: &str) -> Result<Vec<u8>, String> {
    if key.trim().is_empty()
        || key.len() > 8192
        || key.chars().any(char::is_control)
        || key.contains('\'')
    {
        return Err("Harness API Key 不能为空或包含控制字符、单引号".into());
    }
    let text =
        std::str::from_utf8(before.unwrap_or(b"")).map_err(|_| "Harness .env must be UTF-8")?;
    let starts: Vec<_> = text.match_indices(ENV_BEGIN).collect();
    let ends: Vec<_> = text.match_indices(ENV_END).collect();
    let (prefix, suffix) = match (starts.as_slice(), ends.as_slice()) {
        ([], []) => (text, ""),
        ([(start, _)], [(end, _)])
            if start < end
                && (*start == 0 || text.as_bytes()[start - 1] == b'\n')
                && text.as_bytes()[end - 1] == b'\n' =>
        {
            (&text[..*start], &text[end + ENV_END.len()..])
        }
        _ => return Err("Harness .env 托管标记冲突，拒绝覆盖".into()),
    };
    if format!("{prefix}{suffix}").lines().any(|l| {
        l.trim()
            .trim_start_matches("export ")
            .split('=')
            .next()
            .is_some_and(|s| s.trim() == ENV_KEY)
    }) {
        return Err(
            "Harness .env 已有同名非托管密钥，请先处理 HROUTER_MANAGED_API_KEY 冲突".into(),
        );
    }
    let newline = if prefix.is_empty() || prefix.ends_with('\n') {
        ""
    } else {
        "\n"
    };
    Ok(format!(
        "{prefix}{newline}{ENV_BEGIN}\n{ENV_KEY}='{}'\n{ENV_END}\n{suffix}",
        key.trim()
    )
    .into_bytes())
}
struct Prepared {
    path: PathBuf,
    input: PiConnection,
    fingerprint: String,
    native_fingerprint: String,
    env: Option<(PathBuf, Option<Vec<u8>>, Vec<u8>)>,
}
fn prepare(app: &str, provider: &Provider) -> Result<Prepared, String> {
    let mut input = connection(provider)?;
    let path = files::home_path(app)?;
    let env = if app == "deepseek-harness" && input.credential_mode == "literal" {
        let env_path = path.parent().unwrap().join(".env");
        let before = io::read(&env_path)?;
        let after = env_patch(before.as_deref(), &input.credential)?;
        input.credential_mode = "env".into();
        input.credential = ENV_KEY.into();
        Some((env_path, before, after))
    } else {
        None
    };
    let (preview, _, _) = files::review(app, &path, &input)?;
    let mut hash = Sha256::new();
    hash.update(preview.fingerprint.as_bytes());
    if let Some((p, b, a)) = &env {
        hash.update(p.to_string_lossy().as_bytes());
        hash.update([u8::from(b.is_some())]);
        hash.update(b.as_deref().unwrap_or_default());
        hash.update(a);
    }
    Ok(Prepared {
        path,
        input,
        fingerprint: format!("{:x}", hash.finalize()),
        native_fingerprint: preview.fingerprint,
        env,
    })
}
pub fn preview(
    state: &AppState,
    app: &str,
    id: &str,
) -> Result<crate::access_protection::SwitchPreview, String> {
    let provider = state
        .db
        .get_provider_by_id(id, app)
        .map_err(|e| e.to_string())?
        .ok_or("供应商不存在")?;
    let p = prepare(app, &provider)?;
    let mut paths = vec![p.path.display().to_string()];
    if let Some((path, _, _)) = p.env {
        paths.push(path.display().to_string());
    }
    Ok(crate::access_protection::SwitchPreview {
        fingerprint: p.fingerprint,
        protected: true,
        files: paths,
        fields: vec!["服务地址 / 模型 / 凭据；保留其他配置，自动备份，不修改历史会话".into()],
    })
}
fn apply(app: &str, provider: &Provider, expected: Option<&str>) -> Result<(), String> {
    let p = prepare(app, provider)?;
    if expected.is_some_and(|v| v != p.fingerprint) {
        return Err("配置在预览后发生变化，请重新预览".into());
    }
    // .env is consumed by the official Harness launcher. Back it up before changing it.
    if let Some((path, before, after)) = &p.env {
        if let Some(bytes) = before {
            let backup = path
                .parent()
                .unwrap()
                .join("hrouter-backups")
                .join(format!("{}-env", uuid::Uuid::new_v4()));
            io::private_atomic_write(&backup, bytes)?;
        }
        if io::read(path)? != *before {
            return Err("Harness .env 在预览后发生变化".into());
        }
        io::private_atomic_write(path, after)?;
    }
    if let Err(error) = files::apply_at(app, &p.path, &p.input, &p.native_fingerprint) {
        if let Some((path, before, after)) = &p.env {
            if io::read(path)?.as_deref() == Some(after.as_slice()) {
                match before {
                    Some(bytes) => io::private_atomic_write(path, bytes)?,
                    None => std::fs::remove_file(path).map_err(|e| e.to_string())?,
                }
            } else {
                return Err(format!(
                    "{error}; .env 又被其他程序修改，未覆盖；请从备份恢复"
                ));
            }
        }
        return Err(error);
    }
    Ok(())
}
pub fn save(state: &AppState, app: &str, provider: Provider, create: bool) -> Result<bool, String> {
    let _lock = OPERATIONS.lock().map_err(|_| "Provider operation busy")?;
    if !supports(app) {
        return Err("Unsupported agent".into());
    }
    if provider.id.trim().is_empty() || provider.name.trim().is_empty() {
        return Err("供应商名称和 ID 不能为空".into());
    }
    let old = state
        .db
        .get_provider_by_id(&provider.id, app)
        .map_err(|e| e.to_string())?;
    if create && old.is_some() {
        return Err("供应商 ID 已存在".into());
    }
    if !create && old.is_none() {
        return Err("供应商不存在".into());
    }
    let request = connection(&provider)?;
    if request.credential_mode == "keep" {
        return Err("供应商必须保存自己的凭据，不能引用另一供应商的密钥".into());
    }
    // Validate without writing. Harness literal credentials are projected to its .env.
    let mut check = request.clone();
    if app == "deepseek-harness" && check.credential_mode == "literal" {
        env_patch(None, &check.credential)?;
        check.credential_mode = "env".into();
        check.credential = ENV_KEY.into();
    }
    files::build(app, &check, None)?;
    let current = state
        .db
        .get_current_provider(app)
        .map_err(|e| e.to_string())?;
    state
        .db
        .save_provider(app, &provider)
        .map_err(|e| e.to_string())?;
    if current.as_deref() == Some(&provider.id) || current.is_none() {
        if let Err(error) = apply(app, &provider, None) {
            let rollback = match old {
                Some(p) => state.db.save_provider(app, &p),
                None => state.db.delete_provider(app, &provider.id),
            };
            return Err(match rollback {
                Ok(()) => error,
                Err(e) => format!("{error}; 数据库回滚失败: {e}"),
            });
        }
        state
            .db
            .set_current_provider(app, &provider.id)
            .map_err(|e| format!("配置已写入，但启用状态保存失败: {e}"))?;
    }
    Ok(true)
}
pub fn switch(
    state: &AppState,
    app: &str,
    id: &str,
    expected: Option<&str>,
) -> Result<SwitchResult, String> {
    let _lock = OPERATIONS.lock().map_err(|_| "Provider operation busy")?;
    let p = state
        .db
        .get_provider_by_id(id, app)
        .map_err(|e| e.to_string())?
        .ok_or("供应商不存在")?;
    apply(app, &p, expected)?;
    state
        .db
        .set_current_provider(app, id)
        .map_err(|e| format!("配置已写入，但启用状态保存失败: {e}"))?;
    Ok(SwitchResult::default())
}
pub fn delete(state: &AppState, app: &str, id: &str) -> Result<bool, String> {
    let _lock = OPERATIONS.lock().map_err(|_| "Provider operation busy")?;
    if state
        .db
        .get_current_provider(app)
        .map_err(|e| e.to_string())?
        .as_deref()
        == Some(id)
    {
        return Err("请先启用另一个供应商，再删除当前供应商".into());
    }
    state
        .db
        .delete_provider(app, id)
        .map_err(|e| e.to_string())?;
    Ok(true)
}
pub fn import(state: &AppState, app: &str) -> Result<bool, String> {
    let _lock = OPERATIONS.lock().map_err(|_| "Provider operation busy")?;
    let path = files::home_path(app)?;
    let state_live = files::inspect_at(app, &path)?;
    let mut count = 0;
    for mut input in state_live.connections {
        if input.credential_mode == "keep" {
            let bytes = io::read(&path)?.ok_or("配置文件已被移除")?;
            let doc: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            let key = if app == "pi" {
                doc["providers"]["hrouter"]["apiKey"].as_str()
            } else {
                doc["models"]
                    .as_array()
                    .and_then(|rows| rows.iter().find(|row| row["id"] == input.model))
                    .and_then(|r| r["apiKey"].as_str())
            }
            .ok_or("模型没有可导入的 API Key")?;
            input.credential_mode = "literal".into();
            input.credential = key.into();
        }
        let id = format!("import-{:x}", Sha256::digest(input.model.as_bytes()));
        if state
            .db
            .get_provider_by_id(&id, app)
            .map_err(|e| e.to_string())?
            .is_some()
        {
            continue;
        }
        let p:Provider=serde_json::from_value(json!({"id":id,"name":format!("Imported {}",input.model),"settingsConfig":input,"category":"custom","icon":if app=="deepseek-harness"{"deepseek"}else{app}})).map_err(|e|e.to_string())?;
        state.db.save_provider(app, &p).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use serial_test::serial;
    use std::{fs, sync::Arc};
    struct HomeGuard(Option<std::ffi::OsString>);
    impl Drop for HomeGuard {
        fn drop(&mut self) {
            match &self.0 {
                Some(v) => std::env::set_var("CC_SWITCH_TEST_HOME", v),
                None => std::env::remove_var("CC_SWITCH_TEST_HOME"),
            }
        }
    }
    fn with_home(f: impl FnOnce(&AppState, &std::path::Path)) {
        let t = tempfile::tempdir().unwrap();
        let old = HomeGuard(std::env::var_os("CC_SWITCH_TEST_HOME"));
        std::env::set_var("CC_SWITCH_TEST_HOME", t.path());
        let state = AppState::new(Arc::new(Database::memory().unwrap()));
        f(&state, t.path());
        drop(old);
    }
    fn provider(id: &str, model: &str) -> Provider {
        serde_json::from_value(json!({"id":id,"name":id,"settingsConfig":{"baseUrl":"https://relay.example/v1","model":model,"api":"openai-completions","credentialMode":"literal","credential":"test-secret"},"category":"custom"})).unwrap()
    }
    #[test]
    #[serial]
    fn standard_provider_lifecycle_for_all_three_drivers() {
        with_home(|state, home| {
            for app in ["pi", "deepseek-harness", "workbuddy"] {
                assert!(save(state, app, provider("a", "model-a"), true).unwrap());
                assert_eq!(
                    state.db.get_current_provider(app).unwrap().as_deref(),
                    Some("a")
                );
                let path = files::home_path(app).unwrap();
                let first = fs::read(&path).unwrap();
                save(state, app, provider("b", "model-b"), true).unwrap();
                assert_eq!(fs::read(&path).unwrap(), first);
                assert_eq!(state.db.get_all_providers(app).unwrap().len(), 2);
                let p = preview(state, app, "b").unwrap();
                switch(state, app, "b", Some(&p.fingerprint)).unwrap();
                assert_eq!(
                    state.db.get_current_provider(app).unwrap().as_deref(),
                    Some("b")
                );
                let mut edited = provider("b", "model-b");
                edited.settings_config["baseUrl"] = json!("https://updated.example/v1");
                save(state, app, edited, false).unwrap();
                assert!(String::from_utf8_lossy(&fs::read(&path).unwrap())
                    .contains("https://updated.example/v1"));
                assert!(delete(state, app, "b").is_err());
                delete(state, app, "a").unwrap();
                assert_eq!(state.db.get_all_providers(app).unwrap().len(), 1);
                assert!(path.parent().unwrap().join("hrouter-backups").is_dir());
            }
            let env = fs::read_to_string(home.join(".dsh/.env")).unwrap();
            assert!(env.contains("HROUTER_MANAGED_API_KEY='test-secret'"));
        });
    }
    #[test]
    #[serial]
    fn broken_live_config_rolls_back_provider_save() {
        with_home(|state, _| {
            for app in ["pi", "workbuddy", "deepseek-harness"] {
                let p = files::home_path(app).unwrap();
                fs::create_dir_all(p.parent().unwrap()).unwrap();
                fs::write(&p, "{broken").unwrap();
                assert!(save(state, app, provider("bad", "model"), true).is_err());
                assert!(state.db.get_all_providers(app).unwrap().is_empty());
                assert_eq!(fs::read_to_string(&p).unwrap(), "{broken");
            }
        });
    }
    #[test]
    #[serial]
    fn harness_env_revision_and_unrelated_values_are_preserved() {
        with_home(|state, home| {
            let dir = home.join(".dsh");
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join(".env"), "# original\nOTHER=value\n").unwrap();
            save(state, "deepseek-harness", provider("a", "a"), true).unwrap();
            save(state, "deepseek-harness", provider("b", "b"), true).unwrap();
            let p = preview(state, "deepseek-harness", "b").unwrap();
            assert_eq!(p.files.len(), 2);
            assert!(!p.fields.join("").contains("test-secret"));
            let bytes = fs::read_to_string(dir.join(".env")).unwrap();
            assert!(bytes.starts_with("# original\nOTHER=value\n"));
            fs::write(dir.join(".env"), format!("{bytes}\nCONCURRENT=changed\n")).unwrap();
            assert!(switch(state, "deepseek-harness", "b", Some(&p.fingerprint)).is_err());
            assert_eq!(
                state
                    .db
                    .get_current_provider("deepseek-harness")
                    .unwrap()
                    .as_deref(),
                Some("a")
            );
        });
    }
    #[test]
    fn env_patch_refuses_ambiguous_keys_and_preserves_data() {
        assert!(env_patch(Some(b"HROUTER_MANAGED_API_KEY=existing\n"), "new").is_err());
        assert!(env_patch(None, "line\nbreak").is_err());
        assert!(env_patch(None, "quote'key").is_err());
        let bytes = env_patch(Some(b"OTHER=preserved\n"), "secret # $ value").unwrap();
        assert!(String::from_utf8_lossy(&bytes).contains("='secret # $ value'"));
        assert!(env_patch(Some(&bytes), "new").is_ok());
    }
}
