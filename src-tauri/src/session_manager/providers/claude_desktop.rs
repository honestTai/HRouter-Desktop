//! Read-only Claude Desktop history. Code sessions can reference the shared CLI
//! projects tree; Cowork/local Chat sessions keep transcripts in their own tree.
//! Only session metadata and transcript locations are inspected, never Electron
//! caches, credentials, plugins, mounted projects, or cloud chat databases.
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::Value;

use super::claude;
use super::utils::{parse_timestamp_to_ms, truncate_summary, TITLE_MAX_CHARS};
use crate::session_manager::{SessionMessage, SessionMeta};

const PROVIDER_ID: &str = "claude-desktop";
const TREES: [&str; 2] = ["claude-code-sessions", "local-agent-mode-sessions"];
const MAX_METADATA_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSession {
    session_id: String,
    #[serde(default)]
    cli_session_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default)]
    user_selected_folders: Vec<String>,
    #[serde(default)]
    initial_message: Option<String>,
    #[serde(default)]
    created_at: Value,
    #[serde(default)]
    last_activity_at: Value,
}

/// Includes regular, third-party and named Desktop profiles. Keep platform
/// discovery callable from tests on any host, not hidden in cfg-only branches.
fn data_dirs() -> Vec<PathBuf> {
    let home = crate::config::get_home_dir();
    if cfg!(target_os = "macos") {
        macos_data_dirs(&home)
    } else if cfg!(windows) {
        let roaming = std::env::var_os("APPDATA").map(PathBuf::from);
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
        windows_data_dirs(&home, roaming.as_deref(), local.as_deref())
    } else {
        // Supports locally retained/exported Desktop data on other platforms.
        let bases: Vec<_> = dirs::config_dir()
            .into_iter()
            .chain(dirs::data_dir())
            .collect();
        discover_data_dirs(&bases, false)
    }
}

fn macos_data_dirs(home: &Path) -> Vec<PathBuf> {
    discover_data_dirs(&[home.join("Library").join("Application Support")], false)
}

fn windows_data_dirs(home: &Path, roaming: Option<&Path>, local: Option<&Path>) -> Vec<PathBuf> {
    // Environment values can be absent or empty (portable/client launches).
    // Never interpret an invalid override as the current working directory.
    let roaming = roaming
        .filter(|p| p.is_absolute())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| home.join("AppData").join("Roaming"));
    let local = local
        .filter(|p| p.is_absolute())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| home.join("AppData").join("Local"));
    let mut bases = vec![roaming, local.clone()];
    for package in child_dirs(&local.join("Packages")) {
        let Some(name) = package.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let name = name.to_ascii_lowercase();
        // Both package families are used by Desktop. Publisher suffixes may
        // change; match the product prefix, not arbitrary '*claude*' packages.
        if name.starts_with("claude_") || name.starts_with("anthropicpbc.claude_") {
            bases.push(package.join("LocalCache").join("Roaming"));
            bases.push(package.join("LocalCache").join("Local"));
        }
    }
    discover_data_dirs(&bases, true)
}

fn discover_data_dirs(bases: &[PathBuf], case_insensitive: bool) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for base in bases {
        for path in child_dirs(base) {
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            let name = if case_insensitive {
                name.to_ascii_lowercase()
            } else {
                name.to_string()
            };
            let prefix = if case_insensitive { "claude" } else { "Claude" };
            if !name.strip_prefix(prefix).is_some_and(|suffix| {
                suffix.is_empty() || suffix.starts_with('-') || suffix.starts_with(' ')
            }) {
                continue;
            }
            if let Ok(canonical) = path.canonicalize() {
                if seen.insert(canonical) {
                    result.push(path);
                }
            }
        }
    }
    result
}

pub fn merge_sessions(sessions: &mut Vec<SessionMeta>) {
    // A configured CLI override must not hide Desktop's default shared logs.
    let default_projects = crate::config::get_home_dir().join(".claude/projects");
    let configured_projects = crate::config::get_claude_config_dir().join("projects");
    let additional_shared = if path_key(&default_projects) != path_key(&configured_projects) {
        claude::scan_sessions_in(&default_projects)
    } else {
        Vec::new()
    };
    merge_sessions_with_shared(sessions, &data_dirs(), &additional_shared);
}

fn merge_sessions_with_shared(
    sessions: &mut Vec<SessionMeta>,
    dirs: &[PathBuf],
    additional_shared: &[SessionMeta],
) {
    let shared: HashMap<_, _> = additional_shared
        .iter()
        .chain(sessions.iter())
        .filter(|s| matches!(s.provider_id.as_str(), "claude" | PROVIDER_ID))
        .map(|s| (s.session_id.as_str(), s))
        .collect();
    let mut desktop: Vec<_> = additional_shared
        .iter()
        .filter(|s| s.provider_id == PROVIDER_ID)
        .cloned()
        .collect();
    for dir in dirs {
        for tree in TREES {
            let root = dir.join(tree);
            if !root.symlink_metadata().is_ok_and(|m| m.is_dir()) {
                continue;
            }
            // Account/org directories may be UUIDs or shortened 8-character IDs.
            // Bounded traversal prevents walking plugins and session outputs.
            let mut stores = vec![root.clone()];
            for account in child_dirs(&root).into_iter().filter(|p| is_account_dir(p)) {
                stores.extend(child_dirs(&account));
                stores.push(account);
            }
            for store in stores {
                scan_store(
                    &store,
                    &root,
                    tree == "claude-code-sessions",
                    &shared,
                    &mut desktop,
                );
            }
        }
    }
    // Prefer the newest Desktop metadata for a shared transcript. Remove only
    // CLI rows that point to that same file, not unrelated matching IDs.
    desktop.sort_by_key(|s| {
        (
            std::cmp::Reverse(s.last_active_at.or(s.created_at).unwrap_or(0)),
            !s.session_id.starts_with("local_"),
        )
    });
    let mut sources = HashSet::new();
    desktop.retain(|s| {
        s.source_path
            .as_deref()
            .is_some_and(|p| sources.insert(path_key(Path::new(p))))
    });
    sessions.retain(|s| {
        !matches!(s.provider_id.as_str(), "claude" | PROVIDER_ID)
            || !s
                .source_path
                .as_deref()
                .is_some_and(|p| sources.contains(&path_key(Path::new(p))))
    });
    sessions.extend(desktop);
}

fn scan_store(
    store: &Path,
    root: &Path,
    is_code: bool,
    shared: &HashMap<&str, &SessionMeta>,
    sessions: &mut Vec<SessionMeta>,
) {
    let mut claimed = HashSet::new();
    for path in child_files(store) {
        if !is_metadata_path(&path) {
            continue;
        }
        let Some(record) = read_metadata(&path) else {
            continue;
        };
        let storage_dirs = session_dirs(store, &record.session_id);
        let transcript = find_transcript(&record, &storage_dirs, root)
            .or_else(|| {
                if !is_code {
                    return None;
                }
                let id = record.cli_session_id.as_deref()?;
                let path = shared.get(id)?.source_path.as_deref()?;
                Some(PathBuf::from(path))
            })
            .or_else(|| {
                storage_dirs
                    .iter()
                    .map(|d| d.join("audit.jsonl"))
                    .find(|p| regular_within(p, root))
            });
        for dir in &storage_dirs {
            claimed.insert(path_key(dir));
        }
        let mut meta = transcript
            .as_deref()
            .and_then(claude::parse_session)
            .unwrap_or_else(|| empty_meta(&record.session_id));
        meta.provider_id = PROVIDER_ID.to_string();
        meta.session_id = record.session_id.clone();
        meta.read_only = Some(true);
        // VM/remote/local profiles cannot reliably be resumed with `claude --resume`.
        meta.resume_command = None;
        meta.source_path = Some(
            transcript
                .as_deref()
                .unwrap_or(&path)
                .to_string_lossy()
                .into_owned(),
        );
        meta.title = nonempty(record.title.as_deref())
            .or_else(|| nonempty(record.initial_message.as_deref()))
            .map(|s| truncate_summary(s, TITLE_MAX_CHARS))
            .or(meta.title);
        if meta.summary.is_none() {
            meta.summary =
                nonempty(record.initial_message.as_deref()).map(|s| truncate_summary(s, 160));
        }
        // Prefer host folders over the VM's /sessions/... working directory.
        meta.project_dir = record
            .user_selected_folders
            .iter()
            .find_map(|s| nonempty(Some(s)))
            .or_else(|| nonempty(record.cwd.as_deref()))
            .map(str::to_owned)
            .or(meta.project_dir);
        meta.created_at = parse_timestamp_to_ms(&record.created_at).or(meta.created_at);
        meta.last_active_at = parse_timestamp_to_ms(&record.last_activity_at)
            .into_iter()
            .chain(meta.last_active_at)
            .max();
        sessions.push(meta);
    }
    // Transcripts survive metadata loss/partial sync. Read them without scanning
    // subagents or treating audit.jsonl as a second copy of the same session.
    for dir in child_dirs(store) {
        if claimed.contains(&path_key(&dir)) {
            continue;
        }
        let mut transcripts = project_transcripts(&dir.join(".claude/projects"), root);
        if transcripts.is_empty() && regular_within(&dir.join("audit.jsonl"), root) {
            transcripts.push(dir.join("audit.jsonl"));
        }
        for path in transcripts {
            if let Some(mut meta) = claude::parse_session(&path) {
                meta.provider_id = PROVIDER_ID.to_string();
                meta.read_only = Some(true);
                meta.resume_command = None;
                sessions.push(meta);
            }
        }
    }
}

pub fn load_messages(path: &Path) -> Result<Vec<SessionMessage>, String> {
    if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
        return claude::load_messages(path);
    }
    let record =
        read_metadata(path).ok_or_else(|| "Invalid Claude Desktop session metadata".to_string())?;
    // Metadata-only sessions remain useful while the transcript has not synced.
    Ok(nonempty(record.initial_message.as_deref())
        .map(|content| SessionMessage {
            role: "user".into(),
            content: content.to_string(),
            ts: parse_timestamp_to_ms(&record.created_at),
        })
        .into_iter()
        .collect())
}

fn empty_meta(session_id: &str) -> SessionMeta {
    SessionMeta {
        provider_id: PROVIDER_ID.into(),
        session_id: session_id.into(),
        read_only: Some(true),
        title: None,
        summary: None,
        project_dir: None,
        created_at: None,
        last_active_at: None,
        source_path: None,
        resume_command: None,
    }
}

fn read_metadata(path: &Path) -> Option<DesktopSession> {
    if !is_metadata_path(path) {
        return None;
    }
    let file = fs::File::open(path).ok()?;
    if file.metadata().ok()?.len() > MAX_METADATA_BYTES {
        return None;
    }
    let mut bytes = Vec::new();
    file.take(MAX_METADATA_BYTES + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() as u64 > MAX_METADATA_BYTES {
        return None;
    }
    let record: DesktopSession = serde_json::from_slice(&bytes).ok()?;
    if !safe_id(&record.session_id)
        || record
            .cli_session_id
            .as_deref()
            .is_some_and(|s| !safe_id(s))
    {
        return None;
    }
    // Do not import settings or unrelated JSON even if they have an ID.
    if parse_timestamp_to_ms(&record.created_at).is_none()
        && parse_timestamp_to_ms(&record.last_activity_at).is_none()
    {
        return None;
    }
    Some(record)
}

fn is_metadata_path(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some("json")
        && path
            .file_stem()
            .and_then(|s| s.to_str())
            .is_some_and(|s| s.starts_with("local_"))
}

fn safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 200
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}

fn session_dirs(store: &Path, session_id: &str) -> Vec<PathBuf> {
    let mut dirs = vec![store.join(session_id)];
    let id = session_id.strip_prefix("local_").unwrap_or(session_id);
    if id != session_id {
        dirs.push(store.join(id));
    }
    if uuid::Uuid::parse_str(id).is_ok() {
        dirs.push(store.join(id[..8].to_ascii_lowercase()));
    }
    dirs
}

fn find_transcript(record: &DesktopSession, dirs: &[PathBuf], root: &Path) -> Option<PathBuf> {
    for dir in dirs {
        let paths = project_transcripts(&dir.join(".claude/projects"), root);
        if let Some(id) = record.cli_session_id.as_deref() {
            if let Some(path) = paths
                .into_iter()
                .find(|p| p.file_stem().and_then(|n| n.to_str()) == Some(id))
            {
                return Some(path);
            }
        } else if paths.len() == 1 {
            return paths.into_iter().next();
        }
    }
    None
}

fn project_transcripts(projects: &Path, root: &Path) -> Vec<PathBuf> {
    if !projects
        .canonicalize()
        .ok()
        .zip(root.canonicalize().ok())
        .is_some_and(|(p, r)| p.starts_with(r))
    {
        return Vec::new();
    }
    let mut dirs = vec![projects.to_path_buf()];
    dirs.extend(child_dirs(projects));
    dirs.into_iter()
        .flat_map(|d| child_files(&d))
        .filter(|p| {
            p.extension().and_then(|s| s.to_str()) == Some("jsonl")
                && !p
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .is_some_and(|s| s.starts_with("agent-"))
                && regular_within(p, root)
        })
        .collect()
}

fn regular_within(path: &Path, root: &Path) -> bool {
    path.symlink_metadata().is_ok_and(|m| m.is_file())
        && path
            .canonicalize()
            .ok()
            .zip(root.canonicalize().ok())
            .is_some_and(|(p, r)| p.starts_with(r))
}

fn is_account_dir(path: &Path) -> bool {
    path.file_name().and_then(|n| n.to_str()).is_some_and(|n| {
        (8..=36).contains(&n.len()) && n.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-')
    })
}

fn child_dirs(path: &Path) -> Vec<PathBuf> {
    children(path, true)
}
fn child_files(path: &Path) -> Vec<PathBuf> {
    children(path, false)
}
fn children(path: &Path, directories: bool) -> Vec<PathBuf> {
    let mut paths: Vec<_> = fs::read_dir(path)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| {
            e.file_type()
                .is_ok_and(|t| if directories { t.is_dir() } else { t.is_file() })
        })
        .map(|e| e.path())
        .collect();
    paths.sort();
    paths
}
fn path_key(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}
fn nonempty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|s| !s.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    const LOCAL_ID: &str = "local_12345678-1234-4234-8234-123456789abc";
    const CLI_ID: &str = "abcdef12-1234-4234-8234-123456789abc";

    fn write(path: &Path, content: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }
    fn metadata(store: &Path) -> PathBuf {
        let path = store.join(format!("{LOCAL_ID}.json"));
        write(
            &path,
            &json!({
                "sessionId": LOCAL_ID, "cliSessionId": CLI_ID, "title": "Desktop title",
                "cwd": "/sessions/vm-workdir", "userSelectedFolders": ["/host/project"],
                "createdAt": 1791302400000i64, "lastActivityAt": 1791302402000i64,
                "initialMessage": "First question"
            })
            .to_string(),
        );
        path
    }
    fn transcript(path: &Path) {
        write(
            path,
            &format!(
                "{}\n{}\n",
                json!({
                    "sessionId": CLI_ID, "cwd": "/sessions/vm-workdir", "type": "user",
                    "timestamp": "2026-10-07T00:00:00Z",
                    "message": { "role": "user", "content": "First question" }
                }),
                json!({
                    "sessionId": CLI_ID, "type": "assistant", "timestamp": "2026-10-07T00:00:03Z",
                    "message": { "role": "assistant", "content": "Desktop answer" }
                })
            ),
        );
    }
    fn store(dir: &Path, tree: &str) -> PathBuf {
        dir.join(tree).join("12345678").join("00000000")
    }
    fn merge_sessions_from_dirs(sessions: &mut Vec<SessionMeta>, dirs: &[PathBuf]) {
        merge_sessions_with_shared(sessions, dirs, &[]);
    }
    fn assert_source_path(session: &SessionMeta, expected: &Path) {
        // read_dir uses native separators; fixtures can contain mixed separators
        // on Windows. Check file identity, not a platform-specific spelling.
        let actual = session.source_path.as_deref().expect("session source path");
        assert_eq!(
            fs::canonicalize(actual).expect("readable session source"),
            fs::canonicalize(expected).expect("expected fixture source")
        );
    }
    fn scan(dir: &Path) -> Vec<SessionMeta> {
        let mut sessions = Vec::new();
        merge_sessions_from_dirs(&mut sessions, &[dir.to_path_buf()]);
        sessions
    }

    #[test]
    fn discovers_normal_third_party_and_named_profiles_without_duplicates() {
        let temp = tempdir().unwrap();
        for name in [
            "Claude",
            "Claude-3p",
            "Claude Nest",
            "Claude-abc",
            "OtherApp",
            "ClaudeCache",
        ] {
            fs::create_dir(temp.path().join(name)).unwrap();
        }
        let dirs = discover_data_dirs(
            &[temp.path().to_path_buf(), temp.path().to_path_buf()],
            false,
        );
        assert_eq!(dirs.len(), 4);
        assert!(dirs.contains(&temp.path().join("Claude-3p")));
    }

    #[test]
    fn macos_discovers_application_support_profiles_with_unicode_home() {
        let temp = tempdir().unwrap();
        let home = temp.path().join("测试 用户");
        let base = home.join("Library").join("Application Support");
        for name in ["Claude", "Claude-3p", "Claude Nest"] {
            metadata(&store(&base.join(name), TREES[1]));
        }
        fs::create_dir_all(home.join("AppData").join("Roaming").join("Claude")).unwrap();
        let dirs = macos_data_dirs(&home);
        assert_eq!(dirs.len(), 3);
        assert!(dirs.iter().all(|p| p.starts_with(&base)));
        let mut sessions = Vec::new();
        merge_sessions_from_dirs(&mut sessions, &dirs);
        assert_eq!(sessions.len(), 3);
    }

    #[test]
    fn windows_discovers_redirected_roaming_local_and_both_msix_families() {
        let temp = tempdir().unwrap();
        let home = temp.path().join("测试 用户");
        let roaming = temp.path().join("redirected data").join("Roaming");
        let local = temp.path().join("redirected data").join("Local");
        let expected = [
            roaming.join("Claude"),
            local.join("Claude-3p"),
            local.join("Claude-profile-1"),
            roaming.join("cLaUdE Nest"),
            local.join("Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude"),
            local.join("Packages/AnthropicPBC.Claude_fnn82j28hfe8t/LocalCache/Local/Claude-3p"),
        ];
        for dir in &expected {
            metadata(&store(dir, TREES[0]));
        }
        // Do not mix the default home or unrelated app sandboxes into redirected data.
        fs::create_dir_all(home.join("AppData/Roaming/Claude")).unwrap();
        fs::create_dir_all(local.join("Packages/OtherClaudeTool_123/LocalCache/Roaming/Claude"))
            .unwrap();
        let dirs = windows_data_dirs(&home, Some(&roaming), Some(&local));
        assert_eq!(dirs.len(), expected.len());
        for dir in expected {
            assert!(dirs.contains(&dir), "{}", dir.display());
        }
        let mut sessions = Vec::new();
        merge_sessions_from_dirs(&mut sessions, &dirs);
        assert_eq!(sessions.len(), 6);
    }

    #[test]
    fn windows_falls_back_when_appdata_is_absent_empty_or_relative() {
        let temp = tempdir().unwrap();
        let home = temp.path();
        let expected = [
            home.join("AppData/Roaming/Claude"),
            home.join("AppData/Local/Claude-3p"),
        ];
        for dir in &expected {
            fs::create_dir_all(dir).unwrap();
        }
        for invalid in [None, Some(Path::new("")), Some(Path::new("relative-data"))] {
            let dirs = windows_data_dirs(home, invalid, invalid);
            assert_eq!(dirs.len(), 2);
            assert!(expected.iter().all(|p| dirs.contains(p)));
        }
    }

    #[test]
    fn windows_deduplicates_shared_appdata_and_handles_missing_directories() {
        let temp = tempdir().unwrap();
        let shared = temp.path().join("shared");
        fs::create_dir_all(shared.join("CLAUDE-3P")).unwrap();
        assert_eq!(
            windows_data_dirs(temp.path(), Some(&shared), Some(&shared)).len(),
            1
        );
        assert!(windows_data_dirs(&temp.path().join("missing"), None, None).is_empty());
    }

    #[test]
    fn windows_unicode_paths_and_crlf_transcripts_survive_round_trip() {
        let temp = tempdir().unwrap();
        let home = temp.path().join("测试 用户");
        let app = home.join("AppData/Local/Claude-3p");
        let store = store(&app, TREES[1]);
        let metadata_path = metadata(&store);
        let host_project = r"C:\Users\测试 用户\My Project";
        let mut record: Value =
            serde_json::from_str(&fs::read_to_string(&metadata_path).unwrap()).unwrap();
        record["userSelectedFolders"] = json!([host_project]);
        write(
            &metadata_path,
            &serde_json::to_string_pretty(&record)
                .unwrap()
                .replace('\n', "\r\n"),
        );
        let path = store
            .join("12345678")
            .join(format!(".claude/projects/session/{CLI_ID}.jsonl"));
        transcript(&path);
        write(
            &path,
            &fs::read_to_string(&path).unwrap().replace('\n', "\r\n"),
        );
        let mut sessions = Vec::new();
        merge_sessions_from_dirs(&mut sessions, &windows_data_dirs(&home, None, None));
        assert_eq!(sessions.len(), 1);
        let serialized = serde_json::to_value(&sessions[0]).unwrap();
        assert_eq!(serialized["projectDir"], host_project);
        let source = serialized["sourcePath"].as_str().unwrap();
        assert_eq!(load_messages(Path::new(source)).unwrap().len(), 2);
    }

    #[cfg(windows)]
    #[test]
    fn windows_native_verbatim_and_case_aliases_deduplicate() {
        // This additionally runs on windows-latest in the existing CI matrix.
        let temp = tempdir().unwrap();
        let base = temp.path().join("AppData");
        fs::create_dir_all(base.join("Claude-3p")).unwrap();
        let verbatim = base.canonicalize().unwrap();
        let uppercase = PathBuf::from(base.to_string_lossy().to_uppercase());
        let dirs = discover_data_dirs(&[base, verbatim, uppercase], true);
        assert_eq!(dirs.len(), 1);
    }

    #[test]
    fn reads_code_cowork_and_local_chat_in_full_and_short_layouts() {
        for tree in TREES {
            for folder in [LOCAL_ID, "12345678-1234-4234-8234-123456789abc", "12345678"] {
                let temp = tempdir().unwrap();
                let store = store(temp.path(), tree);
                metadata(&store);
                let path = store
                    .join(folder)
                    .join(format!(".claude/projects/session/{CLI_ID}.jsonl"));
                transcript(&path);
                // Audit is not shown as a duplicate if a transcript exists.
                transcript(&store.join(folder).join("audit.jsonl"));
                let sessions = scan(temp.path());
                assert_eq!(sessions.len(), 1, "{tree}/{folder}");
                let meta = &sessions[0];
                assert_eq!(meta.provider_id, PROVIDER_ID);
                assert_eq!(meta.session_id, LOCAL_ID);
                assert_eq!(meta.title.as_deref(), Some("Desktop title"));
                assert_eq!(meta.project_dir.as_deref(), Some("/host/project"));
                assert_eq!(meta.summary.as_deref(), Some("Desktop answer"));
                assert_eq!(meta.created_at, Some(1791302400000));
                assert_eq!(meta.last_active_at, Some(1791331203000));
                assert_eq!(meta.read_only, Some(true));
                assert!(meta.resume_command.is_none());
                let messages = crate::session_manager::load_messages(
                    PROVIDER_ID,
                    meta.source_path.as_deref().unwrap(),
                )
                .unwrap();
                assert_eq!(messages.len(), 2);
                assert_eq!(messages[1].content, "Desktop answer");
            }
        }
    }

    #[test]
    fn code_uses_shared_cli_transcript_and_is_only_listed_once() {
        let temp = tempdir().unwrap();
        let shared_path = temp
            .path()
            .join(format!("custom-cli/projects/project/{CLI_ID}.jsonl"));
        transcript(&shared_path);
        let mut sessions = vec![claude::parse_session(&shared_path).unwrap()];
        let app = temp.path().join("Claude");
        metadata(&store(&app, TREES[0]));
        let second_app = temp.path().join("Claude-3p");
        metadata(&store(&second_app, TREES[0]));
        merge_sessions_from_dirs(&mut sessions, &[app, second_app]);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].provider_id, PROVIDER_ID);
        assert_source_path(&sessions[0], &shared_path);
        assert!(sessions[0].resume_command.is_none());
    }

    #[test]
    fn shared_session_already_identified_as_desktop_still_uses_metadata() {
        let temp = tempdir().unwrap();
        let path = temp.path().join(format!("projects/project/{CLI_ID}.jsonl"));
        transcript(&path);
        let mut cli = claude::parse_session(&path).unwrap();
        cli.provider_id = PROVIDER_ID.into();
        let mut sessions = vec![cli];
        metadata(&store(temp.path(), TREES[0]));
        merge_sessions_from_dirs(&mut sessions, &[temp.path().to_path_buf()]);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].title.as_deref(), Some("Desktop title"));
    }

    #[test]
    fn cowork_does_not_claim_unrelated_cli_session_with_same_id() {
        let temp = tempdir().unwrap();
        let path = temp.path().join(format!("projects/project/{CLI_ID}.jsonl"));
        transcript(&path);
        let mut sessions = vec![claude::parse_session(&path).unwrap()];
        metadata(&store(temp.path(), TREES[1]));
        merge_sessions_from_dirs(&mut sessions, &[temp.path().to_path_buf()]);
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].provider_id, "claude");
        assert_eq!(sessions[1].provider_id, PROVIDER_ID);
    }

    #[test]
    fn full_account_ids_and_distinct_profile_transcripts_are_preserved() {
        let temp = tempdir().unwrap();
        let apps = [temp.path().join("Claude"), temp.path().join("Claude-3p")];
        for app in &apps {
            let store = app
                .join(TREES[1])
                .join("12345678-1234-4234-8234-123456789abc")
                .join("00000000-0000-4000-8000-000000000001");
            let path = metadata(&store);
            let mut record: Value =
                serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
            record["sessionType"] = json!("chat");
            record["isArchived"] = json!(true);
            write(&path, &record.to_string());
            transcript(
                &store
                    .join(LOCAL_ID)
                    .join(format!(".claude/projects/session/{CLI_ID}.jsonl")),
            );
        }
        let mut sessions = Vec::new();
        merge_sessions_from_dirs(&mut sessions, &apps);
        assert_eq!(sessions.len(), 2);
        assert_ne!(sessions[0].source_path, sessions[1].source_path);
        for session in sessions {
            assert_eq!(
                load_messages(Path::new(session.source_path.as_deref().unwrap()))
                    .unwrap()
                    .len(),
                2
            );
        }
    }

    #[test]
    fn metadata_only_sessions_include_initial_message_and_rfc3339_dates() {
        let temp = tempdir().unwrap();
        let path = metadata(&store(temp.path(), TREES[1]));
        let mut record: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        record["sessionType"] = json!("chat");
        record["createdAt"] = json!("2026-10-07T00:00:00Z");
        write(&path, &record.to_string());
        let sessions = scan(temp.path());
        assert_eq!(sessions.len(), 1);
        assert_source_path(&sessions[0], &path);
        let messages = load_messages(&path).unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "First question");
        assert_eq!(messages[0].ts, Some(1791331200000));
    }

    #[test]
    fn audit_fallback_reads_snake_case_ids_roles_tools_and_timestamps() {
        let temp = tempdir().unwrap();
        let store = store(temp.path(), TREES[1]);
        metadata(&store);
        let audit = store.join(LOCAL_ID).join("audit.jsonl");
        write(
            &audit,
            &format!(
                "{}\n{}\n{}\n",
                json!({
                    "session_id": CLI_ID, "type": "user", "_audit_timestamp": "2026-10-07T00:00:00Z",
                    "message": {"content": "Audit question"}
                }),
                json!({
                    "session_id": CLI_ID, "type": "assistant", "message": {"content": [
                        {"type": "text", "text": "Checking"}, {"type": "tool_use", "name": "Read"}
                    ]}
                }),
                json!({
                    "session_id": CLI_ID, "type": "user", "message": {"content": [
                        {"type": "tool_result", "content": "Tool output"}
                    ]}
                })
            ),
        );
        let sessions = scan(temp.path());
        assert_eq!(sessions.len(), 1);
        assert_source_path(&sessions[0], &audit);
        let messages = load_messages(&audit).unwrap();
        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].ts, Some(1791331200000));
        assert_eq!(messages[1].role, "assistant");
        assert!(messages[1].content.contains("[Tool: Read]"));
        assert_eq!(messages[2].role, "tool");
        assert_eq!(claude::parse_session(&audit).unwrap().session_id, CLI_ID);
    }

    #[test]
    fn malformed_metadata_does_not_hide_orphan_transcripts_or_add_subagents() {
        let temp = tempdir().unwrap();
        let store = store(temp.path(), TREES[1]);
        write(&store.join(format!("{LOCAL_ID}.json")), "{broken");
        let projects = store.join("12345678/.claude/projects/session");
        transcript(&projects.join(format!("{CLI_ID}.jsonl")));
        transcript(&projects.join("agent-123.jsonl"));
        transcript(&projects.join("subagents/agent-456.jsonl"));
        transcript(&store.join("12345678/audit.jsonl"));
        let sessions = scan(temp.path());
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, CLI_ID);
        assert_eq!(sessions[0].read_only, Some(true));
    }

    #[test]
    fn ignores_settings_plugins_and_unsafe_session_ids() {
        let temp = tempdir().unwrap();
        let store = store(temp.path(), TREES[1]);
        write(&store.join("scheduled-tasks.json"), "{}");
        write(
            &store.join(format!("{LOCAL_ID}.json")),
            &json!({
                "sessionId": "../../escape", "createdAt": 1791331200000i64
            })
            .to_string(),
        );
        metadata(&temp.path().join(TREES[1]).join("skills-plugin/account"));
        assert!(scan(temp.path()).is_empty());
        assert!(scan(&temp.path().join("missing")).is_empty());
    }

    #[test]
    fn deletion_is_rejected_by_backend_and_preserves_original_files() {
        let temp = tempdir().unwrap();
        let path = metadata(&store(temp.path(), TREES[1]));
        let result =
            crate::session_manager::delete_session(PROVIDER_ID, LOCAL_ID, path.to_str().unwrap());
        assert!(result.unwrap_err().contains("read-only"));
        assert!(path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn does_not_follow_symlinked_accounts_or_transcripts_outside_storage() {
        use std::os::unix::fs::symlink;
        let temp = tempdir().unwrap();
        let outside = temp.path().join("outside");
        let app = temp.path().join("Claude");
        let store = store(&app, TREES[1]);
        metadata(&store);
        let projects = store.join("12345678/.claude/projects");
        let external = outside.join(format!("project/{CLI_ID}.jsonl"));
        transcript(&external);
        fs::create_dir_all(projects.parent().unwrap()).unwrap();
        symlink(&outside, &projects).unwrap();
        symlink(&outside, app.join(TREES[1]).join("abcdef12")).unwrap();
        let sessions = scan(&app);
        assert_eq!(sessions.len(), 1);
        assert!(sessions[0]
            .source_path
            .as_deref()
            .unwrap()
            .ends_with(".json"));
    }
    #[test]
    fn default_shared_logs_remain_available_with_a_custom_cli_directory() {
        let temp = tempdir().unwrap();
        let path = temp
            .path()
            .join(format!("default/projects/project/{CLI_ID}.jsonl"));
        transcript(&path);
        let extra = vec![claude::parse_session(&path).unwrap()];
        metadata(&store(temp.path(), TREES[0]));
        let mut sessions = Vec::new();
        merge_sessions_with_shared(&mut sessions, &[temp.path().to_path_buf()], &extra);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].provider_id, PROVIDER_ID);
        assert_source_path(&sessions[0], &path);
        // Additional ordinary CLI sessions are not imported without Desktop ownership.
        let mut sessions = Vec::new();
        merge_sessions_with_shared(&mut sessions, &[], &extra);
        assert!(sessions.is_empty());
    }

    #[test]
    fn oversized_or_unrelated_metadata_is_not_loaded() {
        let temp = tempdir().unwrap();
        let path = metadata(&store(temp.path(), TREES[1]));
        fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_len(MAX_METADATA_BYTES + 1)
            .unwrap();
        assert!(read_metadata(&path).is_none());
        assert!(scan(temp.path()).is_empty());
        assert!(load_messages(&path).is_err());
        let settings = path.with_file_name("config.json");
        fs::rename(&path, &settings).unwrap();
        assert!(load_messages(&settings).is_err());
    }

    #[test]
    #[ignore = "read-only smoke test requiring local Claude Desktop history"]
    fn local_desktop_read_only_smoke() {
        let mut sessions = claude::scan_sessions();
        merge_sessions(&mut sessions);
        let desktop: Vec<_> = sessions
            .iter()
            .filter(|s| s.provider_id == PROVIDER_ID)
            .collect();
        assert!(!desktop.is_empty(), "No local Desktop history found");
        let mut messages_count = 0;
        for session in &desktop {
            assert_eq!(session.read_only, Some(true));
            assert!(session.resume_command.is_none());
            messages_count += crate::session_manager::load_messages(
                PROVIDER_ID,
                session.source_path.as_deref().unwrap(),
            )
            .expect("Desktop messages should load")
            .len();
        }
        // No titles, paths, message content, account IDs or credentials in output.
        println!(
            "Desktop read-only smoke: {} sessions, {} messages",
            desktop.len(),
            messages_count
        );
    }
}
