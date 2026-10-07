use std::ffi::CStr;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

use objc2_foundation::{NSFileManager, NSString};

const APP_GROUP_IDENTIFIER: &str = "QA2AVNA553.com.hrouter.desktop";

extern "C" {
    fn hrouter_reload_widget_timelines();
}

fn summary_directory() -> Result<PathBuf, String> {
    let group_identifier = NSString::from_str(APP_GROUP_IDENTIFIER);
    // The system API performs the app-group entitlement check and resolves the
    // protected container correctly on macOS 15 and newer.
    let container = unsafe {
        NSFileManager::defaultManager()
            .containerURLForSecurityApplicationGroupIdentifier(&group_identifier)
    }
    .ok_or_else(|| "macOS 未授权 HRouter 小组件共享目录".to_string())?;
    let container_path = unsafe {
        CStr::from_ptr(container.fileSystemRepresentation().as_ptr())
            .to_string_lossy()
            .into_owned()
    };

    Ok(PathBuf::from(container_path)
        .join("Library")
        .join("Application Support")
        .join("HRouter"))
}

// Keep the Agent snapshot independent of account services. Never persist
// credentials, endpoint URLs, script output or session text in the shared container.
static AGENT_WRITE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn write_agent_file(name: &str, payload: serde_json::Value) -> Result<(), String> {
    let _guard = AGENT_WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let directory = summary_directory()?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let tmp = directory.join(format!(".{name}.tmp"));
    fs::write(
        &tmp,
        serde_json::to_vec(&payload).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(tmp, directory.join(name)).map_err(|e| e.to_string())?;
    // WidgetKit owns scheduling; this requests, but does not force, a refresh.
    unsafe { hrouter_reload_widget_timelines() };
    Ok(())
}

pub fn select_agent(app: &str) -> Result<(), String> {
    crate::ResourceTarget::from_str(app)?;
    write_agent_file("selected-agent.json", serde_json::json!({"app": app}))
}

fn agent_file_name(app: &str, kind: &str) -> Result<String, String> {
    // Do not allow caller-supplied paths into the App Group container.
    crate::ResourceTarget::from_str(app)?;
    Ok(format!("agent-{kind}-{app}.json"))
}

pub fn sync_agent_snapshot(v: &serde_json::Value) -> Result<(), String> {
    let app = v["app"].as_str().ok_or("Missing Agent")?;
    write_agent_file(
        &agent_file_name(app, "summary")?,
        serde_json::json!({
            "app":v["app"], "providerId":v["providerId"], "revision":v["providerRevision"],
            "tokens":v["summary"]["realTotalTokens"], "cacheRate":v["summary"]["cacheHitRate"],
            "speed":v["tokensPerSecond"], "speedMeasuredAt":v["speedMeasuredAt"], "updatedAt":v["measuredAt"]
        }),
    )
}

pub fn sync_agent_finance(
    app: &str,
    provider: &str,
    revision: &str,
    v: &serde_json::Value,
) -> Result<(), String> {
    write_agent_file(
        &agent_file_name(app, "finance")?,
        serde_json::json!({
            "app":app, "providerId":provider, "revision":revision,
            "today":v["todayCost"], "spent":v["totalSpent"], "balance":v["balance"],
            "unit":v["unit"], "tpm":v["tokensPerMinute"],
            "updatedAt":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
        }),
    )
}
