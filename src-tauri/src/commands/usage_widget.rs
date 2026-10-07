//! A separate, resizable usage window. No credentials are included in window URLs/events.
use crate::{
    app_config::AppType,
    provider::Provider,
    services::{
        usage_stats::{LogFilters, RequestLogDetail, UsageSummary},
        ProviderService,
    },
    store::AppState,
    ResourceTarget,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    hash::{Hash, Hasher},
    str::FromStr,
    time::Duration,
};
use tauri::{Emitter, Manager, State};

const LABEL: &str = "usage-widget";

#[tauri::command]
pub async fn open_usage_widget(app_handle: tauri::AppHandle, app: String) -> Result<(), String> {
    ResourceTarget::from_str(&app)?;
    if let Some(window) = app_handle.get_webview_window(LABEL) {
        window
            .emit("usage-widget-agent", &app)
            .map_err(|e| e.to_string())?;
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }
    tauri::WebviewWindowBuilder::new(
        &app_handle,
        LABEL,
        tauri::WebviewUrl::App(format!("index.html?usage-widget=1&agent={app}").into()),
    )
    .title("HRouter · Usage")
    .inner_size(400.0, 560.0)
    .min_inner_size(300.0, 280.0)
    .resizable(true)
    .maximizable(true)
    .minimizable(true)
    .skip_taskbar(false)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// This changes only the widget's display selection, never Agent routing.
#[tauri::command]
pub fn select_usage_widget_agent(app: String) -> Result<(), String> {
    ResourceTarget::from_str(&app)?;
    #[cfg(target_os = "macos")]
    crate::macos_widget::select_agent(&app)?;
    Ok(())
}

fn current_provider(state: &AppState, app: &str) -> Result<Option<Provider>, String> {
    ResourceTarget::from_str(app)?;
    let id = if crate::file_provider_service::supports(app) {
        state
            .db
            .get_current_provider(app)
            .map_err(|e| e.to_string())?
            .unwrap_or_default()
    } else {
        ProviderService::current(state, AppType::from_str(app).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?
    };
    if id.is_empty() {
        return Ok(None);
    }
    Ok(state
        .db
        .get_all_providers(app)
        .map_err(|e| e.to_string())?
        .shift_remove(&id))
}

fn credentials(app: &str, provider: &Provider) -> (String, String) {
    if let Ok(native) = AppType::from_str(app) {
        return provider.resolve_usage_credentials(&native);
    }
    let c = &provider.settings_config;
    // Environment references are not literal bearer credentials.
    if c.get("credentialMode")
        .and_then(Value::as_str)
        .is_some_and(|m| m != "literal")
    {
        return (String::new(), String::new());
    }
    (
        c["baseUrl"].as_str().unwrap_or("").into(),
        c["credential"].as_str().unwrap_or("").into(),
    )
}
fn hrouter_endpoint(base: &str, key: &str) -> bool {
    !key.trim().is_empty()
        && !key.starts_with(['$', '{', '<'])
        && url::Url::parse(base).ok().is_some_and(|u| {
            u.scheme() == "https"
                && u.host_str()
                    .is_some_and(|h| h == "hrouter.net" || h.ends_with(".hrouter.net"))
        })
}
fn revision(provider: &Provider) -> String {
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    // Used solely to invalidate a displayed result when the configuration changes.
    let mut value = serde_json::to_value(provider).unwrap_or(Value::Null);
    // Provider metadata contains HashMaps with independently randomized iteration order.
    value.sort_all_objects();
    value.to_string().hash(&mut hash);
    format!("{:x}", hash.finish())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSnapshot {
    app: String,
    provider_id: Option<String>,
    provider_name: Option<String>,
    provider_revision: Option<String>,
    finance_enabled: bool,
    summary: UsageSummary,
    tokens_per_second: Option<f64>,
    speed_samples: usize,
    speed_measured_at: Option<i64>,
    measured_at: i64,
}

fn speed(logs: &[RequestLogDetail], since: i64) -> (Option<f64>, usize) {
    let mut tokens = 0_u64;
    let mut duration = 0_u64;
    let mut samples = 0;
    for row in logs.iter().filter(|r| {
        r.created_at >= since
            && (200..300).contains(&r.status_code)
            && r.output_tokens > 0
            && r.request_count == 1
            && r.data_source
                .as_deref()
                .is_none_or(|source| source == "proxy")
    }) {
        let elapsed = row
            .duration_ms
            .unwrap_or(row.latency_ms)
            .saturating_sub(row.first_token_ms.unwrap_or(0));
        if elapsed == 0 {
            continue;
        }
        tokens += u64::from(row.output_tokens);
        duration += elapsed;
        samples += 1;
    }
    (
        if duration > 0 {
            Some(tokens as f64 * 1000.0 / duration as f64)
        } else {
            None
        },
        samples,
    )
}

// Keep the last real measurement available after the rolling window expires.
// Never infer generation duration from session timestamps or server TPM.
fn speed_with_last_sample(
    logs: &[RequestLogDetail],
    now: i64,
) -> (Option<f64>, usize, Option<i64>) {
    let valid: Vec<_> = logs
        .iter()
        .filter(|row| row.created_at <= now && speed(std::slice::from_ref(row), 0).0.is_some())
        .cloned()
        .collect();
    let measured_at = valid.iter().map(|row| row.created_at).max();
    let (value, samples) = speed(&valid, now - 300);
    if value.is_some() {
        return (value, samples, measured_at);
    }
    if let Some(last) = valid.into_iter().max_by_key(|row| row.created_at) {
        let (value, samples) = speed(std::slice::from_ref(&last), 0);
        return (value, samples, measured_at);
    }
    (None, 0, None)
}

#[tauri::command]
pub fn get_usage_widget_snapshot(
    state: State<'_, AppState>,
    app: String,
) -> Result<WidgetSnapshot, String> {
    let provider = current_provider(&state, &app)?;
    let now = chrono::Local::now();
    let start = now
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .and_then(|date| date.and_local_timezone(chrono::Local).earliest())
        .ok_or("Cannot resolve day boundary")?
        .timestamp();
    let summary = state
        .db
        .get_usage_summary(Some(start), Some(now.timestamp()), Some(&app), None, None)
        .map_err(|e| e.to_string())?;
    let logs = state
        .db
        .get_timed_request_logs(&LogFilters {
            app_type: Some(app.clone()),
            provider_name: None,
            model: None,
            status_code: None,
            start_date: Some(start),
            end_date: Some(now.timestamp()),
        })
        .map_err(|e| e.to_string())?;
    let (tokens_per_second, speed_samples, speed_measured_at) =
        speed_with_last_sample(&logs.data, now.timestamp());
    let finance_enabled = provider.as_ref().is_some_and(|p| {
        let (base, key) = credentials(&app, p);
        hrouter_endpoint(&base, &key)
            || p.meta
                .as_ref()
                .and_then(|m| m.usage_script.as_ref())
                .is_some_and(|s| s.enabled)
    });
    let snapshot = WidgetSnapshot {
        app,
        provider_id: provider.as_ref().map(|p| p.id.clone()),
        provider_name: provider.as_ref().map(|p| p.name.clone()),
        provider_revision: provider.as_ref().map(revision),
        finance_enabled,
        summary,
        tokens_per_second,
        speed_samples,
        speed_measured_at,
        measured_at: now.timestamp(),
    };
    #[cfg(target_os = "macos")]
    if let Err(error) = crate::macos_widget::sync_agent_snapshot(
        &serde_json::to_value(&snapshot).map_err(|e| e.to_string())?,
    ) {
        log::debug!("Cannot sync desktop widget: {error}");
    }
    Ok(snapshot)
}

fn number(v: &Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_str()?.parse().ok())
        .filter(|n| n.is_finite())
}
fn hrouter_finance(v: &Value) -> Value {
    let mut plans = Vec::<Value>::new();
    if let Some(limit) = number(&v["quota"]["limit"]) {
        plans.push(json!({"planName": "Key", "total":limit, "used":number(&v["quota"]["used"]), "remaining":number(&v["quota"]["remaining"]), "unit":v["unit"]}));
    }
    if let Some(rates) = v["rate_limits"].as_array() {
        for rate in rates {
            plans.push(json!({"planName":rate["window"], "total":number(&rate["limit"]), "used":number(&rate["used"]), "remaining":number(&rate["remaining"]), "unit":"CNY"}));
        }
    }
    for (window, prefix) in [("1d", "daily"), ("7d", "weekly"), ("1mo", "monthly")] {
        let subscription = &v["subscription"];
        if let Some(limit) =
            number(&subscription[format!("{prefix}_limit_usd")]).filter(|n| *n > 0.0)
        {
            let used = number(&subscription[format!("{prefix}_usage_usd")]);
            plans.push(json!({"planName":window, "total":limit, "used":used,
                "remaining":used.map(|n| (limit-n).max(0.0)), "unit":v["unit"]}));
        }
    }
    if let Some(balance) = number(&v["balance"]) {
        plans.push(json!({"planName":v["planName"], "remaining":balance, "unit":v["unit"]}));
    } else if plans.is_empty() {
        if let Some(remaining) = number(&v["remaining"]) {
            plans.push(json!({"planName":v["planName"], "remaining":remaining, "unit":v["unit"]}));
        }
    }
    // Actual key charge, not raw model cost, total spend, or account-wide dashboard cost.
    json!({"todayCost":number(&v["usage"]["today"]["actual_cost"]), "unit":v["unit"].as_str().unwrap_or("CNY"), "balance":number(&v["balance"]), "totalSpent":number(&v["usage"]["total"]["actual_cost"]), "tokensPerMinute":number(&v["usage"]["tpm"]).filter(|n| *n >= 0.0), "plans":plans})
}

#[tauri::command]
pub async fn get_usage_widget_finance(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    copilot_state: State<'_, super::copilot::CopilotAuthState>,
    xai_state: State<'_, super::xai_oauth::XaiOAuthState>,
    app: String,
    provider_id: String,
    provider_revision: String,
) -> Result<Value, String> {
    let provider = current_provider(&state, &app)?
        .filter(|p| p.id == provider_id && revision(p) == provider_revision)
        .ok_or("Provider changed; refresh the widget")?;
    let (base, key) = credentials(&app, &provider);
    if hrouter_endpoint(&base, &key) {
        // Fixed origin; never follow redirects carrying the key to a third party.
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(12))
            .build()
            .map_err(|_| "Cannot create usage client")?;
        let mut response = client
            .get("https://hrouter.net/v1/usage")
            .bearer_auth(key)
            .send()
            .await
            .map_err(|_| "HRouter usage request failed")?;
        if !response.status().is_success() {
            return Err(format!("HRouter usage HTTP {}", response.status().as_u16()));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Cannot read usage response")?
        {
            if bytes.len() + chunk.len() > 4 * 1024 * 1024 {
                return Err("Usage response is too large".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        let value: Value = serde_json::from_slice(&bytes).map_err(|_| "Invalid usage response")?;
        if value.get("mode").is_none() {
            return Err("Unsupported HRouter usage response".into());
        }
        let finance = hrouter_finance(&value);
        #[cfg(target_os = "macos")]
        if let Err(error) = crate::macos_widget::sync_agent_finance(
            &app,
            &provider_id,
            &provider_revision,
            &finance,
        ) {
            log::debug!("Cannot sync desktop widget finance: {error}");
        }
        return Ok(finance);
    }
    let script = provider
        .meta
        .as_ref()
        .and_then(|m| m.usage_script.as_ref())
        .filter(|s| s.enabled)
        .ok_or("Usage query is not configured")?;
    let result = if crate::file_provider_service::supports(&app) {
        let raw = crate::usage_script::execute_usage_script(
            &script.code,
            script.api_key.as_deref().unwrap_or(&key),
            script.base_url.as_deref().unwrap_or(&base),
            script.timeout.unwrap_or(10).min(30),
            script.access_token.as_deref(),
            script.user_id.as_deref(),
            script.template_type.as_deref(),
        )
        .await
        .map_err(|_| "Usage query failed")?;
        let data = if raw.is_array() { raw } else { json!([raw]) };
        serde_json::from_value::<Vec<crate::provider::UsageData>>(data)
            .map_err(|_| "Invalid usage result")?
    } else {
        let result = super::provider::queryProviderUsage(
            app_handle,
            state,
            copilot_state,
            xai_state,
            provider_id,
            app,
        )
        .await
        .map_err(|_| "Usage query failed")?;
        if !result.success {
            return Err("Usage query failed".into());
        }
        result.data.unwrap_or_default()
    };
    // Only explicit `extra.todayCost` has daily semantics. `used` can be monthly/lifetime.
    let today = result.iter().find_map(|p| {
        p.extra
            .as_deref()
            .and_then(|s| serde_json::from_str::<Value>(s).ok())
            .and_then(|v| number(&v["todayCost"]))
            .map(|cost| (cost, p.unit.clone()))
    });
    Ok(
        json!({"todayCost":today.as_ref().map(|v| v.0), "unit":today.and_then(|v| v.1), "plans":result}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uses_actual_daily_charge_and_does_not_invent_missing_values() {
        let result = hrouter_finance(
            &json!({"usage":{"today":{"cost":9,"actual_cost":2},"total":{"actual_cost":100}},"balance":50,"unit":"CNY"}),
        );
        assert_eq!(result["todayCost"], 2.0);
        assert_eq!(result["totalSpent"], 100.0);
        assert_eq!(result["balance"], 50.0);
        assert!(result["plans"][0].get("used").is_none());
        assert_eq!(result["plans"][0]["remaining"], 50.0);
        assert!(result["plans"][0].get("total").is_none());
        assert!(hrouter_finance(&json!({}))["todayCost"].is_null());
    }
    #[test]
    fn protects_origin_and_placeholder_credentials() {
        assert!(hrouter_endpoint("https://hrouter.net/v1", "sk-key"));
        for url in [
            "http://hrouter.net",
            "https://hrouter.net.evil.test",
            "https://hrouter.net@evil.test",
        ] {
            assert!(!hrouter_endpoint(url, "key"));
        }
        assert!(!hrouter_endpoint("https://hrouter.net", "${API_KEY}"));
        assert_eq!(speed(&[], 0), (None, 0));
    }
    #[test]
    fn preserves_separate_quota_windows_and_omits_daily_when_only_total_exists() {
        let data = hrouter_finance(
            &json!({"unit":"CNY", "quota":{"limit":100,"used":10,"remaining":90}, "rate_limits":[{"window":"1d","limit":5,"used":2,"remaining":3}], "usage":{"total":{"actual_cost":99}}}),
        );
        assert!(data["todayCost"].is_null());
        assert_eq!(data["plans"].as_array().unwrap().len(), 2);
        assert_eq!(data["plans"][1]["total"], 5.0);
    }
    #[test]
    fn subscription_windows_and_throughput_are_not_generation_speed() {
        let result = hrouter_finance(&json!({"unit":"CNY", "usage":{"tpm":2400},
            "subscription":{"daily_limit_usd":100,"daily_usage_usd":20,"weekly_limit_usd":500,"weekly_usage_usd":100}}));
        assert_eq!(result["tokensPerMinute"], 2400.0);
        assert!(result.get("tokensPerSecond").is_none());
        assert_eq!(result["plans"][0]["used"], 20.0);
        assert_eq!(result["plans"][0]["remaining"], 80.0);
        assert_eq!(result["plans"][1]["total"], 500.0);
    }
    fn request() -> RequestLogDetail {
        serde_json::from_value(json!({"requestId":"r", "requestCount":1, "providerId":"p", "appType":"codex", "model":"m", "costMultiplier":"1", "inputTokens":10,"outputTokens":100,"cacheReadTokens":0,"cacheCreationTokens":0,"inputCostUsd":"0","outputCostUsd":"0","cacheReadCostUsd":"0","cacheCreationCostUsd":"0","totalCostUsd":"0","isStreaming":true,"latencyMs":3000,"firstTokenMs":1000,"durationMs":3000,"statusCode":200,"createdAt":100})).unwrap()
    }
    #[test]
    fn speed_uses_valid_recent_single_requests_and_excludes_first_token_wait() {
        let good = request();
        assert_eq!(speed(&[good.clone()], 0), (Some(50.0), 1));
        assert_eq!(speed(&[good.clone()], 101), (None, 0));
        let mut failed = good.clone();
        failed.status_code = 500;
        let mut no_timing = good.clone();
        no_timing.duration_ms = Some(0);
        let mut aggregated = good.clone();
        aggregated.request_count = 10;
        assert_eq!(
            speed(&[good, failed, no_timing, aggregated], 0),
            (Some(50.0), 1)
        );
    }
    #[test]
    fn last_measured_speed_survives_idle_window_without_becoming_live_zero() {
        let old = request();
        assert_eq!(
            speed_with_last_sample(&[old.clone()], 1000),
            (Some(50.0), 1, Some(100))
        );
        let mut recent = old.clone();
        recent.created_at = 900;
        recent.output_tokens = 200;
        assert_eq!(
            speed_with_last_sample(&[old, recent], 1000),
            (Some(100.0), 1, Some(900))
        );
    }
    #[test]
    fn session_counts_future_and_invalid_timings_never_fabricate_speed() {
        let mut session = request();
        session.data_source = Some("session_log".into());
        let mut future = request();
        future.created_at = 1001;
        let mut invalid = request();
        invalid.first_token_ms = Some(4000);
        assert_eq!(
            speed_with_last_sample(&[session, future, invalid], 1000),
            (None, 0, None)
        );
        assert_eq!(speed_with_last_sample(&[], 1000), (None, 0, None));
    }
    #[test]
    fn missing_and_zero_throughput_remain_distinct_and_negative_is_rejected() {
        assert!(hrouter_finance(&json!({}))["tokensPerMinute"].is_null());
        assert_eq!(
            hrouter_finance(&json!({"usage":{"tpm":0}}))["tokensPerMinute"],
            0.0
        );
        assert!(hrouter_finance(&json!({"usage":{"tpm":-1}}))["tokensPerMinute"].is_null());
    }
    #[test]
    fn file_agents_use_the_saved_literal_credential_not_an_invented_api_key_field() {
        for app in ["pi", "deepseek-harness", "workbuddy"] {
            let mut provider = Provider::with_id(
                "p".into(),
                "P".into(),
                json!({"baseUrl":"https://hrouter.net/v1","credentialMode":"literal","credential":"sk-real"}),
                None,
            );
            assert_eq!(
                credentials(app, &provider),
                ("https://hrouter.net/v1".into(), "sk-real".into())
            );
            provider.settings_config["credentialMode"] = json!("env");
            assert_eq!(credentials(app, &provider), (String::new(), String::new()));
        }
    }
    #[test]
    fn revision_survives_map_reordering_but_invalidates_credential_changes() {
        let value = json!({"id":"p","name":"P","settingsConfig":{"baseUrl":"https://hrouter.net/v1","credential":"one","credentialMode":"literal"},"meta":{"localProxyRequestOverrides":{"headers":{"X-One":"1","X-Two":"2","X-Three":"3"}}}});
        let provider: Provider = serde_json::from_value(value.clone()).unwrap();
        let expected = revision(&provider);
        for _ in 0..20 {
            let roundtrip: Provider = serde_json::from_value(value.clone()).unwrap();
            assert_eq!(revision(&roundtrip), expected);
        }
        let mut changed = provider;
        changed.settings_config["credential"] = json!("two");
        assert_ne!(revision(&changed), expected);
    }
}
