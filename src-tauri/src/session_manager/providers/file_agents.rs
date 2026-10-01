//! Native transcript readers. Source roots/limits/generation selection are shared with usage import.
use super::utils::{extract_text, parse_timestamp_to_ms};
use crate::services::session_usage_extra::{extra_session_root, read_records, session_files};
use crate::session_manager::{SessionMessage, SessionMeta};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
};

const APPS: [&str; 3] = ["pi", "workbuddy", "deepseek-harness"];
pub fn roots(app: &str) -> Vec<PathBuf> {
    extra_session_root(app).into_iter().collect()
}
fn timestamp(row: &Value) -> Option<i64> {
    ["timestamp", "time", "createdAt"]
        .iter()
        .find_map(|key| row.get(key).and_then(parse_timestamp_to_ms))
}
fn identity(app: &str, rows: &[Value]) -> Result<String, String> {
    if app == "workbuddy" {
        let ids: HashSet<_> = rows
            .iter()
            .filter_map(|r| r["sessionId"].as_str())
            .collect();
        if ids.len() != 1 {
            return Err("Expected one CodeBuddy session per transcript".into());
        }
        return Ok((*ids.iter().next().unwrap()).to_owned());
    }
    let header = rows.first().ok_or("Empty session")?;
    let versions = if app == "pi" { 1..=3 } else { 2..=4 };
    if header["type"] != "session"
        || !header["version"]
            .as_u64()
            .is_some_and(|v| versions.contains(&v))
    {
        return Err(format!(
            "Unknown {app} session format; source was not changed"
        ));
    }
    header["id"]
        .as_str()
        .filter(|id| !id.is_empty())
        .map(str::to_owned)
        .ok_or("Missing session ID".into())
}
fn messages(app: &str, rows: &[Value]) -> Result<Vec<SessionMessage>, String> {
    identity(app, rows)?;
    // Follow the active Pi leaf, not abandoned branches. Older v1 logs are linear.
    let tree = app == "pi"
        && rows
            .first()
            .is_some_and(|v| v["version"].as_u64().unwrap_or(0) >= 2);
    let mut branch = Vec::new();
    if tree {
        let entries: HashMap<_, _> = rows
            .iter()
            .skip(1)
            .filter_map(|r| r["id"].as_str().map(|id| (id, r)))
            .collect();
        let mut current = rows.iter().skip(1).rev().find_map(|r| r["id"].as_str());
        let mut visited = HashSet::new();
        while let Some(id) = current {
            if !visited.insert(id) {
                return Err("Cyclic Pi session branch".into());
            }
            let entry = entries.get(id).ok_or("Missing Pi branch parent")?;
            branch.push(*entry);
            current = entry["parentId"].as_str();
        }
        branch.reverse();
    } else {
        branch.extend(rows.iter());
    }
    let mut output = Vec::new();
    for row in branch {
        if row["isMeta"] == true {
            continue;
        }
        let (role, msg) = if app == "deepseek-harness" {
            match row["type"].as_str().unwrap_or("") {
                "user/message" => ("user", &row["data"]),
                "assistant/message" => ("assistant", &row["data"]["message"]),
                "tool/result" => ("tool", &row["data"]["message"]),
                "system/message" => ("system", &row["data"]["message"]),
                "developer/message" => ("developer", &row["data"]["message"]),
                _ => continue,
            }
        } else {
            let msg = &row["message"];
            (msg["role"].as_str().unwrap_or("unknown"), msg)
        };
        let content = extract_text(&msg["content"]);
        if content.trim().is_empty() {
            continue;
        }
        output.push(SessionMessage {
            role: if role == "toolResult" { "tool" } else { role }.into(),
            content,
            ts: timestamp(row).or_else(|| timestamp(msg)),
        });
    }
    Ok(output)
}
fn parse(app: &str, path: &Path) -> Result<SessionMeta, String> {
    let rows = read_records(path).map_err(|e| e.to_string())?;
    let id = identity(app, &rows)?;
    let messages = messages(app, &rows)?;
    let title = rows
        .iter()
        .rev()
        .find(|r| r["type"] == "session_info")
        .and_then(|r| r["name"].as_str())
        .map(str::to_owned)
        .or_else(|| {
            messages
                .iter()
                .find(|m| m.role == "user")
                .map(|m| m.content.chars().take(120).collect())
        });
    let cwd = rows
        .iter()
        .find_map(|r| r["cwd"].as_str())
        .map(str::to_owned);
    // Only generate resumptions verified for these CLIs. Harness can be browsed without inventing flags.
    let resume_command = if app == "pi" && !cfg!(windows) {
        Some(format!(
            "pi --session {}",
            shell_arg(&path.to_string_lossy())
        ))
    } else if app == "workbuddy"
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        Some(format!("codebuddy --resume {id}"))
    } else {
        None
    };
    Ok(SessionMeta {
        read_only: Some(app == "deepseek-harness"),
        provider_id: app.into(),
        session_id: id,
        title,
        summary: None,
        project_dir: cwd,
        created_at: rows.first().and_then(timestamp),
        last_active_at: rows.iter().filter_map(timestamp).max(),
        source_path: Some(path.to_string_lossy().into_owned()),
        resume_command,
    })
}
fn shell_arg(value: &str) -> String {
    #[cfg(not(windows))]
    {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
    // Windows launchers can use cmd or PowerShell; do not generate a file argument with shell metacharacters.
    #[cfg(windows)]
    {
        format!("\"{}\"", value.replace('"', ""))
    }
}
pub fn scan_sessions() -> Vec<SessionMeta> {
    let mut sessions = Vec::new();
    for app in APPS {
        for root in roots(app) {
            for file in session_files(app, &root) {
                match parse(app, &file) {
                    Ok(session) => sessions.push(session),
                    Err(error) => {
                        log::debug!("Skipping {app} transcript {}: {error}", file.display())
                    }
                }
            }
        }
    }
    sessions
}
pub fn load_messages(app: &str, path: &Path) -> Result<Vec<SessionMessage>, String> {
    validate_path(path, &roots(app))?;
    messages(app, &read_records(path).map_err(|e| e.to_string())?)
}
fn validate_path(path: &Path, roots: &[PathBuf]) -> Result<(), String> {
    if std::fs::symlink_metadata(path)
        .map_err(|e| e.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("Session symlinks are not followed".into());
    }
    let canonical = path.canonicalize().map_err(|e| e.to_string())?;
    if !roots
        .iter()
        .filter_map(|r| r.canonicalize().ok())
        .any(|r| canonical.starts_with(r))
    {
        return Err("Session is outside this Agent's data directory".into());
    }
    // Reject links below the configured root; OS aliases such as macOS /var are allowed above it.
    if let Some(root) = roots.iter().find(|r| path.starts_with(r)) {
        let mut cursor = path.parent();
        while let Some(parent) = cursor {
            if parent == root {
                break;
            }
            if std::fs::symlink_metadata(parent).is_ok_and(|m| m.file_type().is_symlink()) {
                return Err("Session directory symlinks are not followed".into());
            }
            cursor = parent.parent();
        }
    }

    Ok(())
}
pub fn delete_session(app: &str, root: &Path, path: &Path, id: &str) -> Result<bool, String> {
    validate_path(path, &[root.to_owned()])?;
    if identity(app, &read_records(path).map_err(|e| e.to_string())?)? != id {
        return Err("Session ID does not match source".into());
    }
    // Harness generations/forks share provenance: deleting one file would resurrect older history.
    // Keep deletion disabled until its native deletion/index API is integrated.
    if app == "deepseek-harness" {
        return Err(
            "Delete Harness sessions from its session manager to preserve generation references"
                .into(),
        );
    }
    std::fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn pi_reads_active_branch_and_tool_messages_only() {
        let rows = vec![
            json!({"type":"session","version":3,"id":"s"}),
            json!({"type":"message","id":"a","parentId":null,"message":{"role":"user","content":"hello"}}),
            json!({"type":"message","id":"abandoned","parentId":"a","message":{"role":"assistant","content":"old"}}),
            json!({"type":"message","id":"b","parentId":"a","message":{"role":"toolResult","content":[{"type":"text","text":"result"}]}}),
        ];
        let output = messages("pi", &rows).unwrap();
        assert_eq!(output.len(), 2);
        assert_eq!(output[1].role, "tool");
        assert_eq!(output[1].content, "result");
    }
    #[test]
    fn harness_maps_native_envelopes_and_rejects_future_versions() {
        let mut rows = vec![
            json!({"type":"session","version":4,"id":"s"}),
            json!({"type":"user/message","data":{"content":"hi"}}),
            json!({"type":"assistant/message","data":{"message":{"content":[{"type":"text","text":"answer"}]}}}),
        ];
        assert_eq!(messages("deepseek-harness", &rows).unwrap().len(), 2);
        rows[0]["version"] = json!(100);
        assert!(messages("deepseek-harness", &rows).is_err());
    }
    #[test]
    fn codebuddy_requires_consistent_session_identity() {
        let mut rows = vec![json!({"sessionId":"a","message":{"role":"user","content":"hi"}})];
        assert_eq!(identity("workbuddy", &rows).unwrap(), "a");
        rows.push(json!({"sessionId":"b"}));
        assert!(identity("workbuddy", &rows).is_err());
    }
    #[test]
    fn deletion_checks_identity_root_and_preserves_harness_generations() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.jsonl");
        std::fs::write(
            &path,
            "{\"type\":\"session\",\"version\":3,\"id\":\"actual\"}\n",
        )
        .unwrap();
        assert!(delete_session("pi", dir.path(), &path, "other").is_err());
        assert!(path.exists());
        assert!(delete_session("deepseek-harness", dir.path(), &path, "actual").is_err());
        assert!(path.exists());
        assert!(delete_session("pi", dir.path(), &path, "actual").unwrap());
        assert!(!path.exists());
    }
    #[test]
    fn transcript_read_is_bounded_and_ignores_torn_last_line() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.jsonl");
        std::fs::write(
            &path,
            "{\"type\":\"session\",\"version\":3,\"id\":\"s\"}\n{unfinished",
        )
        .unwrap();
        assert_eq!(read_records(&path).unwrap().len(), 1);
        let outside = tempfile::tempdir().unwrap();
        assert!(validate_path(&path, &[outside.path().to_owned()]).is_err());
    }
}
