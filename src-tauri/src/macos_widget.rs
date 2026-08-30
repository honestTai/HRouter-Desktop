use std::ffi::CStr;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use objc2_foundation::{NSFileManager, NSString};
use serde::Serialize;

use crate::tray::HRouterTraySummary;

const APP_GROUP_IDENTIFIER: &str = "QA2AVNA553.com.hrouter.desktop";
const SUMMARY_FILE_NAME: &str = "widget-summary.json";

extern "C" {
    fn hrouter_reload_widget_timelines();
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WidgetSummaryPayload {
    schema_version: u8,
    available: bool,
    today_usage: f64,
    balance: f64,
    updated_at: u64,
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

fn summary_payload(summary: Option<HRouterTraySummary>) -> WidgetSummaryPayload {
    let updated_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    WidgetSummaryPayload {
        schema_version: 1,
        available: summary.is_some(),
        today_usage: summary.map_or(0.0, |value| value.today_usage),
        balance: summary.map_or(0.0, |value| value.balance),
        updated_at,
    }
}

pub fn sync_summary(summary: Option<HRouterTraySummary>) -> Result<(), String> {
    let directory = summary_directory()?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建 macOS 小组件共享目录: {error}"))?;

    let payload = serde_json::to_vec(&summary_payload(summary))
        .map_err(|error| format!("无法序列化 macOS 小组件数据: {error}"))?;
    let destination = directory.join(SUMMARY_FILE_NAME);
    let temporary = directory.join(format!(".{SUMMARY_FILE_NAME}.tmp"));
    fs::write(&temporary, payload)
        .map_err(|error| format!("无法写入 macOS 小组件临时数据: {error}"))?;
    fs::rename(&temporary, &destination)
        .map_err(|error| format!("无法更新 macOS 小组件数据: {error}"))?;
    unsafe { hrouter_reload_widget_timelines() };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn widget_payload_uses_frontend_field_names() {
        let encoded = serde_json::to_value(summary_payload(Some(HRouterTraySummary {
            today_usage: 1.25,
            balance: 608.62,
        })))
        .expect("serialize widget payload");

        assert_eq!(encoded["schemaVersion"], 1);
        assert_eq!(encoded["available"], true);
        assert_eq!(encoded["todayUsage"], 1.25);
        assert_eq!(encoded["balance"], 608.62);
        assert!(encoded["updatedAt"].as_u64().is_some());
    }

    #[test]
    fn signed_out_payload_clears_values() {
        let encoded = serde_json::to_value(summary_payload(None)).expect("serialize payload");

        assert_eq!(encoded["available"], false);
        assert_eq!(encoded["todayUsage"], 0.0);
        assert_eq!(encoded["balance"], 0.0);
    }
}
