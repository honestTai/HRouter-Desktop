//! Read-only local usage adapters. Upstream schemas and limitations are recorded in
//! docs/testing/agent-consistency-and-cli-usage-2026-10-01.md.
//! No transcript text or credentials are persisted. Durable checkpoints survive log rollup.
use crate::database::{lock_conn, Database};
use crate::error::AppError;
use crate::proxy::usage::{calculator::CostCalculator, parser::TokenUsage};
use crate::services::session_usage::SessionSyncResult;
use crate::services::usage_stats::{find_model_pricing, has_matching_proxy_usage_log, DedupKey};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use rust_decimal::Decimal;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
};

fn io_error(error: std::io::Error) -> AppError {
    AppError::Config(error.to_string())
}
const MAX_BYTES: u64 = 50 * 1024 * 1024;
const MAX_FILES: usize = 5000;
#[derive(Clone, Debug, Default, PartialEq)]
struct Counts {
    input: u64,
    output: u64,
    read: u64,
    write: u64,
    calls: u64,
}
#[derive(Clone, Debug)]
struct Entry {
    key: String,
    model: String,
    session: String,
    at: i64,
    counts: Counts,
    cumulative: bool,
}
fn number(v: &Value, names: &[&str]) -> u64 {
    names
        .iter()
        .find_map(|k| v.get(*k).and_then(Value::as_u64))
        .unwrap_or(0)
}
fn stamp(v: Option<&Value>) -> Option<i64> {
    let v = v?;
    if let Some(n) = v.as_f64().filter(|n| n.is_finite() && *n > 0.0) {
        return Some(if n > 100_000_000_000.0 {
            (n / 1000.0) as i64
        } else {
            n as i64
        });
    }
    v.as_str()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.timestamp())
}
fn hash(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
fn collect(root: &Path, depth: usize, files: &mut Vec<PathBuf>) {
    if depth > 12 || files.len() >= MAX_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for item in entries.flatten() {
        if files.len() >= MAX_FILES {
            break;
        }
        let Ok(kind) = item.file_type() else {
            continue;
        };
        if kind.is_symlink() {
            continue;
        }
        let path = item.path();
        if kind.is_dir() {
            if !matches!(
                item.file_name().to_str(),
                Some("node_modules" | ".git" | "cache" | ".cache")
            ) {
                collect(&path, depth + 1, files);
            }
        } else if path
            .extension()
            .is_some_and(|e| e == "jsonl" || e == "zstd")
        {
            files.push(path);
        }
    }
}
pub(crate) fn read_records(path: &Path) -> Result<Vec<Value>, AppError> {
    let metadata = fs::symlink_metadata(path).map_err(io_error)?;
    if metadata.file_type().is_symlink() || metadata.len() > MAX_BYTES {
        return Err(AppError::Config(
            "Session file is a symlink or exceeds 50 MiB".into(),
        ));
    }
    let file = fs::File::open(path).map_err(io_error)?;
    let reader: Box<dyn Read> = if path.extension().is_some_and(|e| e == "zstd") {
        Box::new(zstd::stream::read::Decoder::new(file).map_err(io_error)?)
    } else {
        Box::new(file)
    };
    let mut reader = BufReader::new(reader.take(MAX_BYTES + 1));
    let mut rows = Vec::new();
    let mut total = 0u64;
    loop {
        let mut line = Vec::new();
        let n = (&mut reader)
            .take(2 * 1024 * 1024 + 1)
            .read_until(b'\n', &mut line)
            .map_err(io_error)?;
        if n == 0 {
            break;
        }
        total += n as u64;
        if total > MAX_BYTES || n > 2 * 1024 * 1024 {
            return Err(AppError::Config(
                "Decoded session or row exceeds safety limit".into(),
            ));
        }
        // Do not checkpoint an incomplete trailing write.
        if line.last() != Some(&b'\n') {
            break;
        }
        if line.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        rows.push(
            serde_json::from_slice(&line)
                .map_err(|_| AppError::Config("Invalid complete JSONL record".into()))?,
        );
    }
    Ok(rows)
}
fn parse_messages(app: &str, rows: &[Value]) -> Vec<Entry> {
    let mut output = BTreeMap::new();
    for row in rows {
        let Some(message) = row.get("message") else {
            continue;
        };
        if message["role"] != "assistant" {
            continue;
        }
        let Some(usage) = message.get("usage").filter(|u| u.is_object()) else {
            continue;
        };
        let Some(at) = stamp(row.get("timestamp")).or_else(|| stamp(message.get("timestamp")))
        else {
            continue;
        };
        let model = message["model"].as_str().unwrap_or("unknown").to_owned();
        let id = message["id"].as_str().or_else(|| row["id"].as_str());
        let Some(id) = id else {
            continue;
        };
        let session = row["sessionId"]
            .as_str()
            .or_else(|| rows.first().and_then(|v| v["id"].as_str()))
            .unwrap_or("")
            .to_owned();
        let key = if app == "workbuddy" {
            hash(&format!("{app}:{id}:{model}"))
        } else {
            hash(&format!("{app}:{id}:{at}:{model}"))
        };
        // Pi/OpenClaw use fresh input; CodeBuddy's Claude-compatible usage also excludes cache.
        let counts = Counts {
            input: number(usage, &["input", "input_tokens"]),
            output: number(usage, &["output", "output_tokens"]),
            read: number(usage, &["cacheRead", "cache_read_input_tokens"]),
            write: number(usage, &["cacheWrite", "cache_creation_input_tokens"]),
            calls: 1,
        };
        if [counts.input, counts.output, counts.read, counts.write]
            .iter()
            .all(|n| *n == 0)
        {
            continue;
        }
        output.insert(
            key.clone(),
            Entry {
                key,
                model,
                session,
                at,
                counts,
                cumulative: false,
            },
        );
    }
    output.into_values().collect()
}
fn parse_harness(rows: &[Value]) -> Result<Vec<Entry>, AppError> {
    let Some(header) = rows.first().filter(|v| v["type"] == "session") else {
        return Ok(vec![]);
    };
    let version = header["version"].as_u64().unwrap_or(0);
    if !(2..=4).contains(&version) {
        return Err(AppError::Config(format!(
            "Harness session format {version} needs migration by Harness before importing"
        )));
    }
    let session = header["id"].as_str().unwrap_or("");
    if session.is_empty() {
        return Ok(vec![]);
    }
    let mut seed = header["isSeeded"].as_bool().unwrap_or(false);
    let mut attempts: BTreeMap<(u64, u64), u64> = BTreeMap::new();
    let mut entries = BTreeMap::new();
    let mut model = "unknown".to_string();
    for row in rows.iter().skip(1) {
        let data = &row["data"];
        let kind = row["type"].as_str().unwrap_or("");
        if kind == "session/end-seed" {
            seed = false;
            continue;
        }
        if seed {
            continue;
        }
        if kind == "request/header" || kind == "request/context" {
            model = data
                .pointer("/header/config/model")
                .and_then(Value::as_str)
                .or_else(|| data.pointer("/header/model").and_then(Value::as_str))
                .or_else(|| data["model"].as_str())
                .unwrap_or("unknown")
                .to_string();
        }
        let slot = (number(data, &["turn"]), number(data, &["step"]));
        if kind == "llm/retry-started" {
            *attempts.entry(slot).or_default() += 1;
            continue;
        }
        if !matches!(kind, "assistant/message" | "assistant/attempt") {
            continue;
        }
        let usage = data.get("usage").or_else(|| {
            data["stream"]
                .as_array()?
                .iter()
                .rev()
                .find_map(|v| v.get("usage"))
        });
        let Some(usage) = usage else {
            continue;
        };
        let Some(at) = stamp(row.get("time"))
            .or_else(|| stamp(row.get("timestamp")))
            .or_else(|| stamp(row.get("createdAt")))
        else {
            continue;
        };
        let counts = Counts {
            input: number(usage, &["inputTokens"]),
            output: number(usage, &["outputTokens"]),
            read: number(usage, &["cacheReadTokens"]),
            write: number(usage, &["cacheWriteTokens"]),
            calls: 1,
        };
        if [counts.input, counts.output, counts.read, counts.write]
            .iter()
            .all(|n| *n == 0)
        {
            continue;
        }
        let key = hash(&format!(
            "{session}:{}:{}:{}",
            slot.0,
            slot.1,
            attempts.get(&slot).unwrap_or(&0)
        ));
        entries.insert(
            key.clone(),
            Entry {
                key,
                model: model.clone(),
                session: session.into(),
                at,
                counts,
                cumulative: false,
            },
        );
    }
    Ok(entries.into_values().collect())
}
fn store(db: &Database, app: &str, entry: &Entry) -> Result<bool, AppError> {
    if entry.at > chrono::Utc::now().timestamp() - 60 {
        return Ok(false);
    }
    let source = if entry.cumulative {
        "hermes_summary".to_string()
    } else {
        format!("{app}_session")
    };
    let source_key = format!("{app}:{}", entry.key);
    let mut conn = lock_conn!(db.conn);
    let tx = conn.transaction()?;
    let previous = tx.query_row("SELECT input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, request_count FROM agent_usage_checkpoints WHERE source_key=?1", [&source_key], |r| Ok(Counts {input:r.get(0)?,output:r.get(1)?,read:r.get(2)?,write:r.get(3)?,calls:r.get(4)?})).optional()?;
    if previous.as_ref() == Some(&entry.counts) {
        return Ok(false);
    }
    if !entry.cumulative && previous.is_some() {
        return Ok(false);
    }
    let p = previous.unwrap_or_default();
    let n = &entry.counts;
    if n.input < p.input
        || n.output < p.output
        || n.read < p.read
        || n.write < p.write
        || n.calls < p.calls
    {
        return Err(AppError::Config(
            "Upstream usage counters decreased; source preserved, automatic subtraction refused"
                .into(),
        ));
    }
    let delta = Counts {
        input: n.input - p.input,
        output: n.output - p.output,
        read: n.read - p.read,
        write: n.write - p.write,
        calls: n.calls - p.calls,
    };
    let clamp = |n: u64| {
        u32::try_from(n)
            .map_err(|_| AppError::Config("Usage row exceeds supported token range".into()))
    };
    let usage = TokenUsage {
        input_tokens: clamp(delta.input)?,
        output_tokens: clamp(delta.output)?,
        cache_read_tokens: clamp(delta.read)?,
        cache_creation_tokens: clamp(delta.write)?,
        cache_creation_1h_tokens: 0,
        model: Some(entry.model.clone()),
        message_id: None,
    };
    let duplicate = has_matching_proxy_usage_log(
        &tx,
        &DedupKey {
            app_type: app,
            model: &entry.model,
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_tokens: usage.cache_read_tokens,
            cache_creation_tokens: usage.cache_creation_tokens,
            created_at: entry.at,
        },
    )?;
    let mut changed = false;
    if !duplicate {
        let cost = find_model_pricing(&tx, &entry.model)
            .map(|pricing| CostCalculator::calculate_for_app(app, &usage, &pricing, Decimal::ONE));
        let (i, o, r, w, total) = cost
            .map(|c| {
                (
                    c.input_cost.to_string(),
                    c.output_cost.to_string(),
                    c.cache_read_cost.to_string(),
                    c.cache_creation_cost.to_string(),
                    c.total_cost.to_string(),
                )
            })
            .unwrap_or_else(|| ("0".into(), "0".into(), "0".into(), "0".into(), "0".into()));
        let request_id = format!(
            "{source}:{}:{}",
            entry.key,
            hash(&format!("{:?}", entry.counts))
        );
        changed = tx.execute("INSERT OR IGNORE INTO proxy_request_logs (request_id,provider_id,app_type,model,request_model,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens,input_token_semantics,input_cost_usd,output_cost_usd,cache_read_cost_usd,cache_creation_cost_usd,total_cost_usd,latency_ms,status_code,session_id,created_at,data_source,request_count) VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,2,?9,?10,?11,?12,?13,0,200,?14,?15,?16,?17)",params![request_id,format!("_{source}"),app,entry.model,usage.input_tokens,usage.output_tokens,usage.cache_read_tokens,usage.cache_creation_tokens,i,o,r,w,total,entry.session,entry.at,source,delta.calls])? > 0;
    }
    tx.execute("INSERT INTO agent_usage_checkpoints VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(source_key) DO UPDATE SET input_tokens=excluded.input_tokens,output_tokens=excluded.output_tokens,cache_read_tokens=excluded.cache_read_tokens,cache_creation_tokens=excluded.cache_creation_tokens,request_count=excluded.request_count",params![source_key,n.input,n.output,n.read,n.write,n.calls])?;
    tx.commit()?;
    Ok(changed)
}
pub(crate) fn session_files(app: &str, root: &Path) -> Vec<PathBuf> {
    let mut files = vec![];
    collect(root, 0, &mut files);
    files.sort();
    // Retained Harness generations contain the same history. Only select the highest generation per directory.
    if app == "deepseek-harness" {
        let mut generations: BTreeMap<PathBuf, (u64, PathBuf)> = BTreeMap::new();
        for f in files {
            let name = f.file_name().unwrap_or_default().to_string_lossy();
            let ver = if name.starts_with("session.v") {
                name[9..]
                    .split('.')
                    .next()
                    .and_then(|n| n.parse::<u64>().ok())
            } else if name.starts_with("session.jsonl") {
                Some(0)
            } else {
                None
            };
            if let Some(ver) = ver {
                let slot = generations
                    .entry(f.parent().unwrap().to_path_buf())
                    .or_insert((ver, f.clone()));
                if ver > slot.0 {
                    *slot = (ver, f)
                }
            }
        }
        files = generations.into_values().map(|(_, p)| p).collect();
    }
    files
}
fn sync_files(db: &Database, app: &str, root: &Path) -> SessionSyncResult {
    let mut result = SessionSyncResult::default();
    let files = session_files(app, root);
    if files.len() >= MAX_FILES {
        result
            .errors
            .push(format!("{app}: scan limited to {MAX_FILES} files"));
    }
    for file in files {
        result.files_scanned += 1;
        let parsed = read_records(&file).and_then(|rows| {
            if app == "deepseek-harness" {
                parse_harness(&rows)
            } else {
                Ok(parse_messages(app, &rows))
            }
        });
        match parsed {
            Ok(entries) => {
                for entry in entries {
                    if entry.at > chrono::Utc::now().timestamp() - 60 {
                        result.deferred_files += 1;
                        continue;
                    }
                    match store(db, app, &entry) {
                        Ok(true) => result.imported += 1,
                        Ok(false) => result.skipped += 1,
                        Err(e) => result.errors.push(format!("{app}: {e}")),
                    }
                }
            }
            Err(e) => result.errors.push(format!(
                "{app} {}: {e}",
                file.file_name().unwrap_or_default().to_string_lossy()
            )),
        }
    }
    result
}
fn sync_hermes(db: &Database, path: &Path) -> Result<SessionSyncResult, AppError> {
    let mut result = SessionSyncResult::default();
    if !path.exists() {
        return Ok(result);
    }
    if fs::symlink_metadata(path)
        .map_err(io_error)?
        .file_type()
        .is_symlink()
    {
        return Err(AppError::Config(
            "Hermes database symlink is not followed".into(),
        ));
    }
    let source = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    source.busy_timeout(std::time::Duration::from_millis(500))?;
    let mut stmt=source.prepare("SELECT session_id,model,billing_provider,billing_base_url,billing_mode,task,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,api_call_count,last_seen FROM session_model_usage ORDER BY last_seen DESC LIMIT 50000")?;
    let rows = stmt.query_map([], |r| {
        let session: String = r.get(0)?;
        let model: String = r.get(1)?;
        let route = (
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?,
        );
        Ok(Entry {
            key: hash(&format!("{session}:{model}:{route:?}")),
            session,
            model,
            counts: Counts {
                input: r.get::<_, i64>(6)?.max(0) as u64,
                output: r.get::<_, i64>(7)?.max(0) as u64,
                read: r.get::<_, i64>(8)?.max(0) as u64,
                write: r.get::<_, i64>(9)?.max(0) as u64,
                calls: r.get::<_, i64>(10)?.max(0) as u64,
            },
            at: r.get::<_, Option<f64>>(11)?.unwrap_or(0.0) as i64,
            cumulative: true,
        })
    })?;
    result.files_scanned = 1;
    for entry in rows {
        let entry = entry?;
        if entry.at <= 0 {
            continue;
        }
        if entry.at > chrono::Utc::now().timestamp() - 60 {
            result.deferred_files += 1;
            continue;
        }
        match store(db, "hermes", &entry) {
            Ok(true) => result.imported += 1,
            Ok(false) => result.skipped += 1,
            Err(e) => result.errors.push(format!("Hermes: {e}")),
        }
    }
    Ok(result)
}
/// Shared with transcript browsing: both features resolve exactly the same source roots.
pub(crate) fn extra_session_root(app: &str) -> Option<PathBuf> {
    let home = crate::config::get_home_dir();
    let pi_root = crate::external_agents::pi_path()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| home.join(".pi/agent"));
    let pi_sessions = if std::env::var_os("CC_SWITCH_TEST_HOME").is_none() {
        std::env::var_os("PI_CODING_AGENT_SESSION_DIR")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .unwrap_or_else(|| pi_root.join("sessions"))
    } else {
        pi_root.join("sessions")
    };
    let pi_sessions = if pi_sessions == pi_root.join("sessions") {
        // Absolute/home-relative global overrides are resolvable without guessing a project cwd.
        fs::read(pi_root.join("settings.json"))
            .ok()
            .and_then(|raw| serde_json::from_slice::<Value>(&raw).ok())
            .and_then(|v| v["sessionDir"].as_str().map(str::to_owned))
            .and_then(|v| {
                if let Some(tail) = v.strip_prefix("~/") {
                    Some(home.join(tail))
                } else {
                    let path = PathBuf::from(v);
                    path.is_absolute().then_some(path)
                }
            })
            .unwrap_or(pi_sessions)
    } else {
        pi_sessions
    };
    let harness = crate::agent_configs::home_path("deepseek-harness")
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| home.join(".dsh"));
    match app {
        "pi" => Some(pi_sessions),
        "workbuddy" => Some(home.join(".codebuddy/projects")),
        "deepseek-harness" => Some(harness),
        _ => None,
    }
}
pub fn sync_extra_usage(db: &Database) -> SessionSyncResult {
    let home = crate::config::get_home_dir();
    let mut result = SessionSyncResult::default();
    for (app, path) in [
        ("pi", extra_session_root("pi").unwrap()),
        (
            "openclaw",
            crate::openclaw_config::get_openclaw_dir().join("agents"),
        ),
        ("workbuddy", home.join(".codebuddy/projects")),
        (
            "deepseek-harness",
            extra_session_root("deepseek-harness").unwrap(),
        ),
    ] {
        result.merge(sync_files(db, app, &path));
    }
    match sync_hermes(db, &crate::hermes_config::get_hermes_dir().join("state.db")) {
        Ok(r) => result.merge(r),
        Err(e) => result.errors.push(format!("Hermes: {e}")),
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn message(id: &str) -> Value {
        json!({"type":"message","id":id,"timestamp":"2023-11-14T22:13:20Z","message":{"role":"assistant","model":"test-model","usage":{"input":10,"output":4,"cacheRead":3,"cacheWrite":2}}})
    }
    fn entry(calls: u64) -> Entry {
        Entry {
            key: "summary-test".into(),
            session: "s".into(),
            model: "test-model".into(),
            at: 1_700_000_000,
            counts: Counts {
                input: 10 * calls,
                output: 4 * calls,
                read: 3 * calls,
                write: 2 * calls,
                calls,
            },
            cumulative: true,
        }
    }
    #[test]
    fn message_adapters_use_real_usage_and_deduplicate_forked_history() -> Result<(), AppError> {
        let db = Database::memory()?;
        for app in ["pi", "openclaw", "workbuddy"] {
            let row = message("stable");
            let parsed = parse_messages(app, &[row.clone(), row]);
            assert_eq!(parsed.len(), 1);
            assert!(store(&db, app, &parsed[0])?);
            assert!(!store(&db, app, &parsed[0])?);
            let summary = db.get_usage_summary(None, None, Some(app), None, None)?;
            assert_eq!(summary.total_requests, 1);
        }
        assert!(parse_messages(
            "pi",
            &[json!({"message":{"role":"user","content":"hello"}})]
        )
        .is_empty());
        Ok(())
    }
    #[test]
    fn summary_counts_are_weighted_and_checkpoint_survives_pruning() -> Result<(), AppError> {
        let db = Database::memory()?;
        assert!(store(&db, "hermes", &entry(3))?);
        assert!(!store(&db, "hermes", &entry(3))?);
        assert!(store(&db, "hermes", &entry(5))?);
        let summary = db.get_usage_summary(None, None, Some("hermes"), None, None)?;
        assert_eq!(summary.total_requests, 5);
        assert!(store(&db, "hermes", &entry(2)).is_err());
        assert_eq!(db.rollup_and_prune(1)?, 2);
        let rolled = db.get_usage_summary(None, None, Some("hermes"), None, None)?;
        assert_eq!(
            rolled.total_requests, 5,
            "rollup keeps weighted call counts, not row count"
        );
        assert!(!store(&db, "hermes", &entry(5))?);
        Ok(())
    }
    #[test]
    fn harness_replaces_same_attempt_but_counts_retries_and_excludes_seed() {
        let mut rows = vec![
            json!({"type":"session","version":3,"id":"dsh","isSeeded":true}),
            json!({"type":"assistant/message","time":1_700_000_000_000i64,"data":{"turn":0,"step":0,"usage":{"inputTokens":999,"outputTokens":1}}}),
            json!({"type":"session/end-seed"}),
        ];
        let settlement = json!({"type":"assistant/message","time":1_700_000_000_000i64,"data":{"turn":1,"step":1,"usage":{"inputTokens":10,"outputTokens":3}}});
        rows.push(
            json!({"type":"request/header","data":{"header":{"config":{"model":"dsh-model"}}}}),
        );
        rows.push(settlement.clone());
        rows.push(settlement.clone());
        assert_eq!(parse_harness(&rows).unwrap()[0].model, "dsh-model");
        assert_eq!(parse_harness(&rows).unwrap().len(), 1);
        rows.push(json!({"type":"llm/retry-started","data":{"turn":1,"step":1}}));
        rows.push(settlement);
        assert_eq!(parse_harness(&rows).unwrap().len(), 2);
        rows[0]["version"] = json!(99);
        assert!(parse_harness(&rows).is_err());
    }
    #[test]
    fn compressed_jsonl_and_incomplete_tail_are_read_without_writing() -> Result<(), AppError> {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.v3.jsonl.zstd");
        let bytes = format!("{}\n{{\"partial\":", message("one"));
        let compressed = zstd::stream::encode_all(bytes.as_bytes(), 0).unwrap();
        fs::write(&path, &compressed).unwrap();
        assert_eq!(read_records(&path)?.len(), 1);
        assert_eq!(fs::read(path).unwrap(), compressed);
        Ok(())
    }
    #[test]
    fn hermes_reads_model_ledger_without_modifying_source() -> Result<(), AppError> {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("state.db");
        {
            let source = Connection::open(&path)?;
            source.execute_batch("CREATE TABLE session_model_usage(session_id TEXT,model TEXT,billing_provider TEXT,billing_base_url TEXT,billing_mode TEXT,task TEXT,input_tokens INTEGER,output_tokens INTEGER,cache_read_tokens INTEGER,cache_write_tokens INTEGER,api_call_count INTEGER,last_seen REAL); INSERT INTO session_model_usage VALUES ('s','test-model','official','','','',30,12,9,6,3,1700000000);")?;
        }
        let before = fs::read(&path).unwrap();
        let db = Database::memory()?;
        assert_eq!(sync_hermes(&db, &path)?.imported, 1);
        assert_eq!(sync_hermes(&db, &path)?.imported, 0);
        assert_eq!(
            db.get_usage_summary(None, None, Some("hermes"), None, None)?
                .total_requests,
            3
        );
        assert_eq!(fs::read(path).unwrap(), before);
        Ok(())
    }
    #[cfg(unix)]
    #[test]
    fn traversal_does_not_follow_symlinked_transcripts() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.jsonl"), "{}\n").unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("linked")).unwrap();
        let mut files = vec![];
        collect(dir.path(), 0, &mut files);
        assert!(files.is_empty());
    }
}
