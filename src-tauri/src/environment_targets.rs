//! Explicit independent config targets, including Windows-accessible WSL UNC paths.
use crate::{app_config::AppType, database::Database, error::AppError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, str::FromStr};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentTarget {
    pub name: String,
    pub app: String,
    pub directory: String,
    pub provider_id: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetPreview {
    pub fingerprint: String,
    pub files: Vec<String>,
}
#[derive(Serialize)]
struct Write {
    path: PathBuf,
    before: Option<String>,
    after: String,
    local_identity: Option<LocalIdentity>,
}
#[derive(Serialize)]
struct LocalIdentity {
    app: String,
    before_database: Option<String>,
    before_settings: Option<String>,
    after: String,
}
fn store_path() -> PathBuf {
    crate::config::get_app_config_dir().join("environment-targets.json")
}
pub fn list() -> Result<Vec<EnvironmentTarget>, AppError> {
    match std::fs::read_to_string(store_path()) {
        Ok(s) => serde_json::from_str(&s).map_err(|_| AppError::Config("环境目标配置无效".into())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
        Err(e) => Err(AppError::io(store_path(), e)),
    }
}
pub fn save(db: &Database, targets: &[EnvironmentTarget]) -> Result<(), AppError> {
    prepare(db, targets)?;
    crate::config::write_json_file(&store_path(), &targets)
}
fn read(path: &PathBuf) -> Result<Option<String>, AppError> {
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(AppError::io(path, e)),
    }
}
fn prepare(db: &Database, targets: &[EnvironmentTarget]) -> Result<Vec<Write>, AppError> {
    if targets.len() > 20 {
        return Err(AppError::InvalidInput("最多保存 20 个环境目标".into()));
    }
    let mut writes = vec![];
    let mut seen = std::collections::HashSet::new();
    for target in targets {
        let app = AppType::from_str(&target.app)?;
        let path = PathBuf::from(&target.directory);
        if target.name.trim().is_empty()
            || !path.is_absolute()
            || !crate::access_protection::supported(&app)
        {
            return Err(AppError::InvalidInput(
                "请提供环境名称、Claude/Codex 和配置目录绝对路径".into(),
            ));
        }
        // Existing directories ensure a mistyped UNC path cannot create an
        // unintended environment. WSL distro must be accessible to Windows.
        let path = std::fs::canonicalize(&path).map_err(|e| AppError::io(&path, e))?;
        if !path.is_dir() {
            return Err(AppError::InvalidInput("目标必须是已存在的配置目录".into()));
        }
        let local_file = match app {
            AppType::Claude => crate::config::get_claude_settings_path(),
            _ => crate::codex_config::get_codex_config_path(),
        };
        let is_local = local_file
            .parent()
            .and_then(|p| std::fs::canonicalize(p).ok())
            .is_some_and(|p| p == path);
        if is_local && futures::executor::block_on(db.get_live_backup(&target.app))?.is_some() {
            return Err(AppError::InvalidInput(
                "本机目录已被代理接管，请先关闭接管再部署".into(),
            ));
        }
        let provider = db
            .get_provider_by_id(&target.provider_id, &target.app)?
            .ok_or_else(|| AppError::InvalidInput("目标供应商不存在".into()))?;
        if provider.category.as_deref() == Some("official")
            || provider.is_codex_oauth()
            || provider.is_xai_oauth()
        {
            return Err(AppError::InvalidInput(
                "独立环境部署仅支持 API Key 供应商；官方账户请在对应环境登录".into(),
            ));
        }
        let mut push = |file: &str,
                        build: &dyn Fn(Option<&str>) -> Result<String, AppError>|
         -> Result<(), AppError> {
            let path = path.join(file);
            if !seen.insert(path.clone()) {
                return Err(AppError::InvalidInput(
                    "环境目标重复写入同一配置文件".into(),
                ));
            }
            let before = read(&path)?;
            let after = build(before.as_deref())?;
            writes.push(Write {
                path,
                before,
                after,
                local_identity: if is_local {
                    Some(LocalIdentity {
                        app: target.app.clone(),
                        before_database: db.get_current_provider(&target.app)?,
                        before_settings: crate::settings::get_current_provider(&app),
                        after: target.provider_id.clone(),
                    })
                } else {
                    None
                },
            });
            Ok(())
        };
        match app {
            AppType::Claude => push("settings.json", &|before| {
                let live: Value = serde_json::from_str(before.unwrap_or("{}"))
                    .map_err(|_| AppError::Config("目标 Claude 配置 JSON 无效".into()))?;
                let merged =
                    crate::access_protection::preserve_claude(&live, &provider.settings_config)?;
                serde_json::to_string_pretty(&merged).map_err(|e| AppError::Message(e.to_string()))
            })?,
            AppType::Codex => {
                let config = provider
                    .settings_config
                    .get("config")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let mut doc = config
                    .parse::<toml_edit::DocumentMut>()
                    .map_err(|_| AppError::Config("供应商 Codex TOML 无效".into()))?;
                let id = doc
                    .get("model_provider")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        AppError::InvalidInput("Codex 需要显式的自定义 model_provider".into())
                    })?
                    .to_string();
                if doc
                    .get("model_providers")
                    .and_then(|p| p.get(&id))
                    .and_then(|p| p.as_table_like())
                    .is_none()
                {
                    return Err(AppError::InvalidInput(
                        "Codex 缺少有效的供应商配置表".into(),
                    ));
                }
                let key = provider
                    .settings_config
                    .pointer("/auth/OPENAI_API_KEY")
                    .and_then(Value::as_str)
                    .or_else(|| {
                        doc.get("model_providers")
                            .and_then(|p| p.get(&id))
                            .and_then(|p| p.get("experimental_bearer_token"))
                            .and_then(|v| v.as_str())
                    })
                    .filter(|s| !s.trim().is_empty())
                    .ok_or_else(|| AppError::InvalidInput("供应商缺少 API Key".into()))?
                    .to_string();
                // Credentials are resolved inside the backend, never returned by preview.
                doc["model_providers"][&id]["experimental_bearer_token"] = toml_edit::value(key);
                doc["model_providers"][&id]["requires_openai_auth"] = toml_edit::value(false);
                // A Windows-generated catalog path cannot be reused inside WSL.
                doc.remove("model_catalog_json");
                push("config.toml", &|before| {
                    crate::access_protection::preserve_codex(before.unwrap_or(""), &doc.to_string())
                })?;
            }
            _ => unreachable!(),
        }
    }
    Ok(writes)
}
fn preview_writes(writes: &[Write]) -> TargetPreview {
    TargetPreview {
        fingerprint: format!("{:x}", Sha256::digest(serde_json::to_vec(writes).unwrap())),
        files: writes
            .iter()
            .map(|w| w.path.to_string_lossy().into_owned())
            .collect(),
    }
}
pub fn preview(db: &Database, targets: &[EnvironmentTarget]) -> Result<TargetPreview, AppError> {
    Ok(preview_writes(&prepare(db, targets)?))
}
pub fn apply(
    db: &Database,
    targets: &[EnvironmentTarget],
    expected: &str,
) -> Result<String, AppError> {
    let writes = prepare(db, targets)?;
    if preview_writes(&writes).fingerprint != expected {
        return Err(AppError::Message(
            "目标配置或供应商已变化，请重新预览".into(),
        ));
    }
    let directory = crate::config::get_app_config_dir().join("environment-snapshots");
    std::fs::create_dir_all(&directory).map_err(|e| AppError::io(&directory, e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| AppError::io(&directory, e))?;
    }
    let backup = directory.join(format!("{}.json", uuid::Uuid::new_v4()));
    crate::config::write_json_file(&backup, &json!({"files":writes}))?;
    let mut attempted = 0;
    let mut identities_attempted = 0;
    let result = (|| -> Result<(), AppError> {
        for write in &writes {
            attempted += 1;
            crate::config::write_text_file(&write.path, &write.after)?;
        }
        for write in &writes {
            identities_attempted += 1;
            if let Some(identity) = &write.local_identity {
                db.set_current_provider(&identity.app, &identity.after)?;
                crate::settings::set_current_provider(
                    &AppType::from_str(&identity.app)?,
                    Some(&identity.after),
                )?;
            }
        }
        Ok(())
    })();
    if let Err(error) = result {
        let mut rollback_errors = vec![];
        for previous in writes[..attempted].iter().rev() {
            let result = match &previous.before {
                Some(text) => crate::config::write_text_file(&previous.path, text),
                None => match std::fs::remove_file(&previous.path) {
                    Ok(()) => Ok(()),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                    Err(e) => Err(AppError::io(&previous.path, e)),
                },
            };
            if let Err(e) = result {
                rollback_errors.push(e.to_string());
            }
        }
        for write in writes[..identities_attempted].iter().rev() {
            if let Some(identity) = &write.local_identity {
                if let Err(e) = db.set_current_provider(
                    &identity.app,
                    identity.before_database.as_deref().unwrap_or(""),
                ) {
                    rollback_errors.push(e.to_string());
                }
                if let Err(e) = crate::settings::set_current_provider(
                    &AppType::from_str(&identity.app)?,
                    identity.before_settings.as_deref(),
                ) {
                    rollback_errors.push(e.to_string());
                }
            }
        }
        return Err(AppError::Message(format!(
            "写入失败：{error}；回滚错误：{}；恢复快照：{}",
            rollback_errors.join("；"),
            backup.display()
        )));
    }
    Ok(backup.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn separate_targets_keep_local_rules_and_preview_never_exposes_keys() {
        let db = Database::memory().unwrap();
        let temp = tempfile::tempdir().unwrap();
        db.save_provider(
            "claude",
            &crate::provider::Provider::with_id(
                "p".into(),
                "p".into(),
                json!({"env":{"ANTHROPIC_API_KEY":"secret-test"}}),
                None,
            ),
        )
        .unwrap();
        let mut targets = vec![];
        for name in ["Windows", "WSL"] {
            let path = temp.path().join(name);
            std::fs::create_dir(&path).unwrap();
            std::fs::write(
                path.join("settings.json"),
                r#"{"hooks":{"keep":true},"env":{"CUSTOM":"keep"}}"#,
            )
            .unwrap();
            targets.push(EnvironmentTarget {
                name: name.into(),
                app: "claude".into(),
                directory: path.to_string_lossy().into_owned(),
                provider_id: "p".into(),
            });
        }
        let writes = prepare(&db, &targets).unwrap();
        assert_eq!(writes.len(), 2);
        for write in &writes {
            let after: Value = serde_json::from_str(&write.after).unwrap();
            assert_eq!(after["hooks"]["keep"], true);
            assert_eq!(after["env"]["CUSTOM"], "keep");
        }
        let report = preview(&db, &targets).unwrap();
        assert!(!serde_json::to_string(&report)
            .unwrap()
            .contains("secret-test"));
        let mut duplicate = targets.clone();
        duplicate.push(targets[0].clone());
        assert!(prepare(&db, &duplicate).is_err());
    }
}
