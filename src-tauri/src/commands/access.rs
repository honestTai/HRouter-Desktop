//! Explicit, bounded diagnostic requests. Never changes routing health or sends user conversations.
use crate::{app_config::AppType, provider::Provider, store::AppState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    str::FromStr,
    time::{Duration, Instant},
};
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticStep {
    name: String,
    status: String,
    message: String,
    elapsed_ms: u128,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReport {
    tested_at: i64,
    model: String,
    protocol: String,
    steps: Vec<DiagnosticStep>,
    models: Vec<String>,
}

fn protocol(provider: &Provider, app: &AppType) -> String {
    if matches!(app, AppType::Claude) {
        return crate::proxy::providers::get_claude_api_format(provider).into();
    }
    if let Some(format) = provider.meta.as_ref().and_then(|m| m.api_format.as_deref()) {
        return format.to_string();
    }
    if matches!(app, AppType::Codex) {
        let config = provider
            .settings_config
            .get("config")
            .and_then(Value::as_str)
            .unwrap_or("");
        if let Ok(doc) = config.parse::<toml_edit::DocumentMut>() {
            if let Some(id) = doc.get("model_provider").and_then(|i| i.as_str()) {
                let wire = doc
                    .get("model_providers")
                    .and_then(|i| i.get(id))
                    .and_then(|i| i.get("wire_api"))
                    .and_then(|i| i.as_str());
                return match wire {
                    Some("chat") => "openai_chat",
                    Some("anthropic") | Some("messages") => "anthropic",
                    _ => "openai_responses",
                }
                .into();
            }
        }
        "openai_responses".into()
    } else {
        "anthropic".into()
    }
}

fn endpoint(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.ends_with("/v1") {
        format!("{base}/{path}")
    } else {
        format!("{base}/v1/{path}")
    }
}

fn request_body(format: &str, model: &str, stream: bool, tools: bool) -> Value {
    let prompt = if tools {
        "Call hrouter_probe with value equal to ok. Do not execute any other action."
    } else {
        "Reply with OK."
    };
    let schema = json!({"type":"object","properties":{"value":{"type":"string"}},"required":["value"],"additionalProperties":false});
    match format {
        "anthropic" => {
            let mut body = json!({"model":model,"max_tokens":128,"stream":stream,"messages":[{"role":"user","content":prompt}]});
            if tools {
                body["tools"] = json!([{"name":"hrouter_probe","description":"Return a diagnostic value; no side effects.","input_schema":schema}]);
                body["tool_choice"] = json!({"type":"tool","name":"hrouter_probe"});
            }
            body
        }
        "openai_chat" => {
            let mut body = json!({"model":model,"max_tokens":128,"stream":stream,"messages":[{"role":"user","content":prompt}]});
            if tools {
                body["tools"] = json!([{"type":"function","function":{"name":"hrouter_probe","description":"Return a diagnostic value; no side effects.","parameters":schema}}]);
                body["tool_choice"] =
                    json!({"type":"function","function":{"name":"hrouter_probe"}});
            }
            body
        }
        _ => {
            let mut body = json!({"model":model,"max_output_tokens":128,"stream":stream,"input":[{"role":"user","content":prompt}]});
            if tools {
                body["tools"] = json!([{"type":"function","name":"hrouter_probe","description":"Return a diagnostic value; no side effects.","parameters":schema}]);
                body["tool_choice"] = json!({"type":"function","name":"hrouter_probe"});
            }
            body
        }
    }
}

fn valid_tool(value: &Value, format: &str) -> bool {
    let valid_args = |v: &Value| v.get("value").and_then(Value::as_str) == Some("ok");
    match format {
        "anthropic" => value
            .get("content")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items.iter().any(|i| {
                    i["type"] == "tool_use"
                        && i["name"] == "hrouter_probe"
                        && valid_args(&i["input"])
                })
            }),
        "openai_chat" => value
            .pointer("/choices/0/message/tool_calls")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items.iter().any(|i| {
                    i["function"]["name"] == "hrouter_probe"
                        && i["function"]["arguments"]
                            .as_str()
                            .and_then(|s| serde_json::from_str::<Value>(s).ok())
                            .is_some_and(|a| valid_args(&a))
                })
            }),
        _ => value
            .get("output")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items.iter().any(|i| {
                    i["type"] == "function_call"
                        && i["name"] == "hrouter_probe"
                        && i["arguments"]
                            .as_str()
                            .and_then(|s| serde_json::from_str::<Value>(s).ok())
                            .is_some_and(|a| valid_args(&a))
                })
            }),
    }
}

fn tool_continuation(format: &str, model: &str, response: &Value) -> Result<Value, String> {
    let mut body = request_body(format, model, false, true);
    body.as_object_mut().unwrap().remove("tool_choice");
    let result = "Probe completed successfully. Reply with OK.";
    match format {
        "anthropic" => {
            let blocks = response
                .get("content")
                .and_then(Value::as_array)
                .ok_or("缺少工具调用内容")?;
            let mut results = vec![];
            for block in blocks.iter().filter(|v| v["type"] == "tool_use") {
                let id = block["id"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .ok_or("工具调用缺少 ID")?;
                results.push(json!({"type":"tool_result","tool_use_id":id,"content":result}));
            }
            body["messages"].as_array_mut().unwrap().extend([
                json!({"role":"assistant","content":blocks}),
                json!({"role":"user","content":results}),
            ]);
        }
        "openai_chat" => {
            let assistant = response
                .pointer("/choices/0/message")
                .ok_or("缺少 assistant 消息")?;
            let calls = assistant["tool_calls"].as_array().ok_or("缺少工具调用")?;
            let messages = body["messages"].as_array_mut().unwrap();
            messages.push(assistant.clone());
            for call in calls {
                let id = call["id"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .ok_or("工具调用缺少 ID")?;
                messages.push(json!({"role":"tool","tool_call_id":id,"content":result}));
            }
        }
        _ => {
            let output = response["output"]
                .as_array()
                .ok_or("缺少 Responses output")?;
            let inputs = body["input"].as_array_mut().unwrap();
            inputs.extend(output.iter().cloned());
            for call in output.iter().filter(|v| v["type"] == "function_call") {
                let id = call["call_id"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .ok_or("工具调用缺少 call_id")?;
                inputs.push(json!({"type":"function_call_output","call_id":id,"output":result}));
            }
        }
    }
    Ok(body)
}

fn valid_text(value: &Value, format: &str) -> bool {
    match format {
        "anthropic" => value
            .get("content")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items.iter().any(|i| {
                    i["type"] == "text" && i["text"].as_str().is_some_and(|s| !s.is_empty())
                })
            }),
        "openai_chat" => value
            .pointer("/choices/0/message/content")
            .and_then(Value::as_str)
            .is_some_and(|s| !s.is_empty()),
        _ => value
            .get("output")
            .and_then(Value::as_array)
            .is_some_and(|items| {
                items.iter().any(|i| {
                    i.get("content")
                        .and_then(Value::as_array)
                        .is_some_and(|parts| {
                            parts.iter().any(|p| {
                                p["type"] == "output_text"
                                    && p["text"].as_str().is_some_and(|s| !s.is_empty())
                            })
                        })
                })
            }),
    }
}

fn valid_stream(text: &str, format: &str) -> bool {
    let mut content = false;
    let mut completed = false;
    for line in text
        .lines()
        .filter_map(|l| l.strip_prefix("data:").map(str::trim))
    {
        if line == "[DONE]" {
            completed = true;
            continue;
        }
        if let Ok(v) = serde_json::from_str::<Value>(line) {
            if v.get("error").is_some() || v["type"] == "error" || v["type"] == "response.failed" {
                return false;
            }
            match format {
                "anthropic" => {
                    content |= v
                        .pointer("/delta/text")
                        .and_then(Value::as_str)
                        .is_some_and(|s| !s.is_empty());
                    completed |= v["type"] == "message_stop";
                }
                "openai_chat" => {
                    content |= v
                        .pointer("/choices/0/delta/content")
                        .and_then(Value::as_str)
                        .is_some_and(|s| !s.is_empty());
                    completed |= v
                        .pointer("/choices/0/finish_reason")
                        .and_then(Value::as_str)
                        == Some("stop");
                }
                _ => {
                    content |= v["type"] == "response.output_text.delta"
                        && v["delta"].as_str().is_some_and(|s| !s.is_empty());
                    completed |= v["type"] == "response.completed";
                }
            }
        }
    }
    content && completed
}

fn http_hint(status: u16) -> &'static str {
    match status {
        401 | 403 => "鉴权失败：检查 Key、权限或渠道限制。",
        404 | 405 => "接口不存在：检查地址前缀与上游协议。",
        429 => "额度或速率受限：检查余额、套餐和并发限制。",
        400 | 422 => "请求被拒绝：检查模型名称及协议、参数支持情况。",
        500..=599 => "上游服务失败：可用相同模型直连复查，或检查备用线路。",
        300..=399 => "接口发生重定向：请填写最终 API 地址，体检不会携带 Key 跟随跳转。",
        _ => "接口返回异常状态，请检查服务商配置。",
    }
}

async fn bounded_body(mut response: reqwest::Response) -> Result<String, String> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "读取响应失败或超时。".to_string())?
    {
        if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
            return Err("响应超出体检的 2 MiB 限制。".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| "响应不是有效 UTF-8。".into())
}

#[tauri::command]
pub async fn diagnose_provider(
    state: State<'_, AppState>,
    app: String,
    id: String,
    model: String,
    allow_paid: bool,
) -> Result<DiagnosticReport, String> {
    let app = AppType::from_str(&app).map_err(|e| e.to_string())?;
    if !matches!(app, AppType::Claude | AppType::Codex) {
        return Err("真实请求体检目前支持 Claude Code 和 Codex。".into());
    }
    let provider = state
        .db
        .get_provider_by_id(&id, app.as_str())
        .map_err(|e| e.to_string())?
        .ok_or("供应商不存在")?;
    if provider.category.as_deref() == Some("official")
        || provider
            .meta
            .as_ref()
            .and_then(|m| m.provider_type.as_deref())
            .is_some_and(|p| matches!(p, "github_copilot" | "codex_oauth" | "xai_oauth"))
    {
        return Err("此体检仅适用于 API Key 供应商；官方登录请在对应客户端验证。".into());
    }
    let adapter = crate::proxy::providers::get_adapter(&app);
    let base = adapter
        .extract_base_url(&provider)
        .map_err(|_| "无法解析 API 地址")?;
    let url = reqwest::Url::parse(&base).map_err(|_| "API 地址无效")?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("请使用不含用户名、密码、查询参数或片段的 HTTP(S) API 地址。".into());
    }
    let auth = adapter.extract_auth(&provider).ok_or("未配置 API Key")?;
    if auth.api_key.trim().is_empty() {
        return Err("未配置 API Key".into());
    }
    let format = protocol(&provider, &app);
    if !matches!(
        format.as_str(),
        "anthropic" | "openai_chat" | "openai_responses"
    ) {
        return Err("此协议暂不支持真实请求体检。".into());
    }
    let mut client_builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(45));
    if let Some(proxy) = state
        .db
        .get_global_proxy_url()
        .map_err(|_| "无法读取代理配置")?
    {
        if !proxy.trim().is_empty() {
            client_builder =
                client_builder.proxy(reqwest::Proxy::all(proxy).map_err(|_| "全局代理地址无效")?);
        }
    }
    if let Some(agent) = provider
        .meta
        .as_ref()
        .and_then(|m| m.custom_user_agent.as_deref())
    {
        client_builder = client_builder.user_agent(agent);
    }
    let client = client_builder.build().map_err(|_| "无法创建体检连接")?;
    let authorize = |request: reqwest::RequestBuilder| {
        if format == "anthropic" {
            let request = request.header("anthropic-version", "2023-06-01");
            if matches!(
                auth.strategy,
                crate::proxy::providers::AuthStrategy::ClaudeAuth
                    | crate::proxy::providers::AuthStrategy::Bearer
            ) {
                request.bearer_auth(&auth.api_key)
            } else {
                request.header("x-api-key", &auth.api_key)
            }
        } else {
            request.bearer_auth(&auth.api_key)
        }
    };
    let mut report = DiagnosticReport {
        tested_at: chrono::Utc::now().timestamp(),
        model: model.trim().to_string(),
        protocol: format.clone(),
        steps: vec![],
        models: vec![],
    };
    let current = crate::settings::get_effective_current_provider(&state.db, &app)
        .map_err(|_| "无法读取当前供应商")?;
    let routed = state
        .proxy_service
        .detect_takeover_in_live_config_for_app(&app);
    let (local_status, local_message) = if routed {
        (
            "skipped",
            "当前为本地路由模式。本次测试直接请求供应商，不验证本机代理转换链路。",
        )
    } else if current.as_deref() != Some(&id) {
        ("skipped", "此供应商尚未设为当前配置；体检不会自动启用它。")
    } else {
        let matches = crate::services::provider::read_live_settings(app.clone())
            .ok()
            .is_some_and(|live| {
                let mut candidate = provider.clone();
                candidate.settings_config = live;
                adapter
                    .extract_base_url(&candidate)
                    .ok()
                    .is_some_and(|b| b.trim_end_matches('/') == base.trim_end_matches('/'))
                    && adapter
                        .extract_auth(&candidate)
                        .is_some_and(|a| a.api_key == auth.api_key)
            });
        if matches {
            ("passed", "本地配置中的地址和凭据与所选供应商一致。运行中的客户端是否已重新加载仍需在客户端确认。")
        } else {
            (
                "failed",
                "本地配置与供应商不一致或无法读取，请重新应用配置并检查配置目录。",
            )
        }
    };
    report.steps.push(DiagnosticStep {
        name: "本地配置".into(),
        status: local_status.into(),
        message: local_message.into(),
        elapsed_ms: 0,
    });
    let full = provider
        .meta
        .as_ref()
        .and_then(|m| m.is_full_url)
        .unwrap_or(false);
    let mut probes = vec![("模型目录", false, false)];
    if allow_paid {
        if report.model.is_empty() || report.model.len() > 256 {
            return Err("请填写有效模型 ID 后再执行付费体检。".into());
        }
        probes.extend([
            ("普通响应", false, false),
            ("流式响应", true, false),
            ("工具调用", false, true),
            ("工具结果续传", false, false),
        ]);
    }
    let mut tool_reply: Option<Value> = None;
    for (name, stream, tools) in probes {
        if name == "模型目录" && full {
            report.steps.push(DiagnosticStep {
                name: name.into(),
                status: "skipped".into(),
                message: "完整请求地址未提供独立模型目录；请在通用表单中配置模型目录地址。".into(),
                elapsed_ms: 0,
            });
            continue;
        }
        let started = Instant::now();
        let body = if name == "工具结果续传" {
            match tool_reply
                .as_ref()
                .ok_or("前一步工具调用未通过".to_string())
                .and_then(|reply| tool_continuation(&format, &report.model, reply))
            {
                Ok(body) => body,
                Err(message) => {
                    report.steps.push(DiagnosticStep {
                        name: name.into(),
                        status: "skipped".into(),
                        message,
                        elapsed_ms: 0,
                    });
                    continue;
                }
            }
        } else {
            request_body(&format, &report.model, stream, tools)
        };
        let request = if name == "模型目录" {
            authorize(client.get(endpoint(&base, "models")))
        } else {
            let path = match format.as_str() {
                "anthropic" => "messages",
                "openai_chat" => "chat/completions",
                _ => "responses",
            };
            authorize(client.post(if full {
                base.clone()
            } else {
                endpoint(&base, path)
            }))
            .json(&body)
        };
        let outcome: Result<String, String> = async {
            let response = request.send().await.map_err(|e| {
                if e.is_timeout() {
                    "连接或请求超时，请检查网络及上游响应。".into()
                } else {
                    "连接失败，请检查 DNS、TLS、系统代理与 API 地址。".to_string()
                }
            })?;
            let status = response.status();
            if !status.is_success() {
                return Err(format!(
                    "HTTP {} · {}",
                    status.as_u16(),
                    http_hint(status.as_u16())
                ));
            }
            let text = bounded_body(response).await?;
            if name == "模型目录" {
                let value: Value = serde_json::from_str(&text)
                    .map_err(|_| "模型目录不是 JSON，可能填入了网站页面地址。")?;
                let items = value
                    .get("data")
                    .or_else(|| value.get("models"))
                    .and_then(Value::as_array)
                    .ok_or("目录格式不兼容，需要 data 或 models 数组。")?;
                report.models = items
                    .iter()
                    .filter_map(|v| {
                        v.get("id")
                            .or_else(|| v.get("slug"))
                            .and_then(Value::as_str)
                            .map(str::to_owned)
                    })
                    .collect();
                if report.models.is_empty() {
                    return Err("模型目录为空或缺少模型 ID。".into());
                }
                Ok(format!(
                    "鉴权及目录请求成功，共 {} 个模型。目录可用不代表所有模型均可调用。",
                    report.models.len()
                ))
            } else if stream {
                if valid_stream(&text, &format) {
                    Ok("收到有效文本增量与结束事件。".into())
                } else {
                    Err("未收到完整的文本事件流；检查协议、流式支持或截断问题。".into())
                }
            } else {
                let value: Value =
                    serde_json::from_str(&text).map_err(|_| "响应不是预期 JSON。")?;
                if if tools {
                    valid_tool(&value, &format)
                } else {
                    valid_text(&value, &format)
                } {
                    if tools {
                        tool_reply = Some(value.clone());
                    }
                    Ok(if tools {
                        "模型返回了正确的工具名称和参数；未执行工具。"
                    } else {
                        "模型返回了有效文本。"
                    }
                    .into())
                } else {
                    Err(if tools {
                        "未收到预期工具调用；该模型或接口可能不支持指定工具。"
                    } else {
                        "HTTP 成功，但没有符合协议的文本输出；可能是参数、推理预算或格式不兼容。"
                    }
                    .into())
                }
            }
        }
        .await;
        report.steps.push(DiagnosticStep {
            name: name.into(),
            status: if outcome.is_ok() { "passed" } else { "failed" }.into(),
            message: outcome.unwrap_or_else(|e| e),
            elapsed_ms: started.elapsed().as_millis(),
        });
    }
    Ok(report)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCandidate {
    id: String,
    app: String,
    name: String,
    exists: bool,
}

fn read_source(path: &str) -> Result<Vec<(String, Provider)>, String> {
    let conn =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "无法只读打开 CC Switch 数据库，请选择 cc-switch.db。")?;
    conn.busy_timeout(Duration::from_secs(3))
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, app_type, name, settings_config, category, meta FROM providers LIMIT 2001",
        )
        .map_err(|_| "数据库缺少兼容的供应商表。")?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, Option<String>>(4)?,
                r.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut result = vec![];
    for row in rows {
        let (id, app, name, settings, category, meta) = row.map_err(|e| e.to_string())?;
        if AppType::from_str(&app).is_err()
            || matches!(category.as_deref(), Some("omo" | "omo-slim" | "official"))
        {
            continue;
        }
        let settings_config: Value =
            serde_json::from_str(&settings).map_err(|_| "源供应商包含无效 JSON，未导入。")?;
        if settings_config.pointer("/auth/tokens").is_some() {
            continue;
        }
        if !settings_config.is_object() {
            return Err("源供应商配置必须是对象。".into());
        }
        let mut metadata: crate::provider::ProviderMeta =
            serde_json::from_str(&meta).map_err(|_| "源供应商元数据不兼容，未导入。")?;
        if metadata
            .provider_type
            .as_deref()
            .is_some_and(|p| matches!(p, "github_copilot" | "codex_oauth" | "xai_oauth"))
        {
            continue;
        }
        metadata.live_config_managed = Some(false);
        // Usage scripts execute code. Do not silently migrate them with API credentials.
        metadata.usage_script = None;
        result.push((
            app,
            Provider {
                id: format!("cc-import-{id}"),
                name,
                settings_config,
                category,
                meta: Some(metadata),
                website_url: None,
                created_at: Some(chrono::Utc::now().timestamp_millis()),
                sort_index: None,
                notes: Some("从 CC Switch 导入；未启用、未迁移用量脚本或登录态。".into()),
                icon: None,
                icon_color: None,
                in_failover_queue: false,
            },
        ));
        if result.len() > 2000 {
            return Err("供应商数量超过 2000，请先缩小迁移范围。".into());
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn preview_cc_switch_import(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<ImportCandidate>, String> {
    read_source(&path)?
        .into_iter()
        .map(|(app, p)| {
            let exists = state
                .db
                .get_provider_by_id(&p.id, &app)
                .map_err(|e| e.to_string())?
                .is_some();
            Ok(ImportCandidate {
                id: p.id,
                app,
                name: p.name,
                exists,
            })
        })
        .collect()
}

#[tauri::command]
pub fn import_cc_switch_providers(
    state: State<'_, AppState>,
    path: String,
    selected: Vec<String>,
) -> Result<usize, String> {
    let candidates = read_source(&path)?;
    let mut count = 0;
    for (app, provider) in candidates {
        if !selected.contains(&format!("{app}:{}", provider.id))
            || state
                .db
                .get_provider_by_id(&provider.id, &app)
                .map_err(|e| e.to_string())?
                .is_some()
        {
            continue;
        }
        state
            .db
            .save_provider(&app, &provider)
            .map_err(|e| format!("已导入 {count} 项，其余未完成：{e}"))?;
        count += 1;
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stream_requires_content_and_completion() {
        assert!(!valid_stream("data: [DONE]\n", "openai_chat"));
        assert!(!valid_stream(
            "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n",
            "openai_chat"
        ));
        assert!(valid_stream(
            "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\ndata: [DONE]\n",
            "openai_chat"
        ));
        assert!(!valid_stream(
            "data: {\"error\":{}}\ndata: [DONE]\n",
            "openai_chat"
        ));
    }
    #[test]
    fn tools_require_name_and_arguments() {
        assert!(valid_tool(
            &json!({"content":[{"type":"tool_use","name":"hrouter_probe","input":{"value":"ok"}}]}),
            "anthropic"
        ));
        assert!(!valid_tool(
            &json!({"content":[{"type":"tool_use","name":"hrouter_probe","input":{}}]}),
            "anthropic"
        ));
        assert!(!valid_tool(
            &json!({"choices":[{"message":{"content":"I called the tool"}}]}),
            "openai_chat"
        ));
    }
    #[test]
    fn tool_continuations_preserve_call_ids_for_all_protocols() {
        let examples = [
            (
                "anthropic",
                json!({"content":[{"type":"tool_use","id":"call-a","name":"hrouter_probe","input":{"value":"ok"}}]}),
                "/messages/2/content/0/tool_use_id",
            ),
            (
                "openai_chat",
                json!({"choices":[{"message":{"role":"assistant","tool_calls":[{"id":"call-a","type":"function","function":{"name":"hrouter_probe","arguments":"{\"value\":\"ok\"}"}}]}}]}),
                "/messages/2/tool_call_id",
            ),
            (
                "openai_responses",
                json!({"output":[{"type":"function_call","call_id":"call-a","name":"hrouter_probe","arguments":"{\"value\":\"ok\"}"}]}),
                "/input/2/call_id",
            ),
        ];
        for (format, response, path) in examples {
            assert!(valid_tool(&response, format));
            let body = tool_continuation(format, "m", &response).unwrap();
            assert_eq!(body.pointer(path).and_then(Value::as_str), Some("call-a"));
            assert!(body.get("tool_choice").is_none());
        }
    }
    #[test]
    fn paths_do_not_duplicate_version() {
        assert_eq!(
            endpoint("https://example.org/v1/", "responses"),
            "https://example.org/v1/responses"
        );
        assert_eq!(
            endpoint("https://example.org/anthropic", "messages"),
            "https://example.org/anthropic/v1/messages"
        );
    }
    #[test]
    fn import_does_not_modify_source_and_disables_scripts() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("cc-switch.db");
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute_batch("CREATE TABLE providers (id TEXT, app_type TEXT, name TEXT, settings_config TEXT, category TEXT, meta TEXT); INSERT INTO providers VALUES ('a','claude','Test','{\"env\":{}}','custom','{}');").unwrap();
        drop(conn);
        let before = std::fs::read(&path).unwrap();
        let result = read_source(path.to_str().unwrap()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0].1.meta.as_ref().unwrap().live_config_managed,
            Some(false)
        );
        assert!(result[0].1.meta.as_ref().unwrap().usage_script.is_none());
        assert_eq!(before, std::fs::read(path).unwrap());
    }
}

#[tauri::command]
pub fn get_access_protection(app: String) -> Result<bool, String> {
    Ok(crate::access_protection::enabled(
        &AppType::from_str(&app).map_err(|e| e.to_string())?,
    ))
}
#[tauri::command]
pub fn get_prompt_protection(app: String) -> Result<bool, String> {
    Ok(crate::access_protection::prompts_protected(
        &AppType::from_str(&app).map_err(|e| e.to_string())?,
    ))
}
#[tauri::command]
pub fn get_providers_only_sync() -> bool {
    crate::access_protection::providers_only_sync()
}
#[tauri::command]
pub fn get_lite_mode() -> bool {
    crate::access_protection::lite_mode()
}
#[tauri::command]
pub fn get_environment_targets(
) -> Result<Vec<crate::environment_targets::EnvironmentTarget>, String> {
    crate::environment_targets::list().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_environment_targets(
    state: State<'_, AppState>,
    targets: Vec<crate::environment_targets::EnvironmentTarget>,
) -> Result<(), String> {
    crate::environment_targets::save(&state.db, &targets).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn preview_environment_targets(
    state: State<'_, AppState>,
    targets: Vec<crate::environment_targets::EnvironmentTarget>,
) -> Result<crate::environment_targets::TargetPreview, String> {
    crate::environment_targets::preview(&state.db, &targets).map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn apply_environment_targets(
    state: State<'_, AppState>,
    targets: Vec<crate::environment_targets::EnvironmentTarget>,
    fingerprint: String,
) -> Result<String, String> {
    let _claude_guard = state.proxy_service.lock_switch_for_app("claude").await;
    let _codex_guard = state.proxy_service.lock_switch_for_app("codex").await;
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::environment_targets::apply(&db, &targets, &fingerprint).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn set_lite_mode(enabled: bool) -> Result<(), String> {
    crate::access_protection::set_lite_mode(enabled).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_providers_only_sync(enabled: bool) -> Result<(), String> {
    crate::access_protection::set_providers_only_sync(enabled).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn get_model_routes(
    state: State<'_, AppState>,
    app: String,
) -> Result<Vec<crate::model_routes::ModelRoute>, String> {
    crate::model_routes::read(&state.db, &app).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_model_routes(
    state: State<'_, AppState>,
    app: String,
    routes: Vec<crate::model_routes::ModelRoute>,
) -> Result<(), String> {
    crate::model_routes::save(&state.db, &app, routes).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_provider_compatibility(
    state: State<'_, AppState>,
    app: String,
    id: String,
    session_bridge: bool,
    standard_http: bool,
) -> Result<(), String> {
    if !matches!(app.as_str(), "claude" | "codex") {
        return Err("仅支持 Claude/Codex".into());
    }
    let mut provider = state
        .db
        .get_provider_by_id(&id, &app)
        .map_err(|e| e.to_string())?
        .ok_or("供应商不存在")?;
    let meta = provider.meta.get_or_insert_with(Default::default);
    meta.codex_session_compatibility = Some(app == "codex" && session_bridge);
    meta.standard_http_transport = Some(standard_http);
    state
        .db
        .save_provider(&app, &provider)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_prompt_protection(app: String, enabled: bool) -> Result<(), String> {
    crate::access_protection::set_prompts_protected(
        &AppType::from_str(&app).map_err(|e| e.to_string())?,
        enabled,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_access_protection(app: String, enabled: bool) -> Result<(), String> {
    crate::access_protection::set_enabled(
        &AppType::from_str(&app).map_err(|e| e.to_string())?,
        enabled,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn preview_access_switch(
    state: State<'_, AppState>,
    app: String,
    id: String,
) -> Result<crate::access_protection::SwitchPreview, String> {
    crate::access_protection::preview(
        &state.db,
        &AppType::from_str(&app).map_err(|e| e.to_string())?,
        &id,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn list_access_snapshots(
    app: String,
) -> Result<Vec<crate::access_protection::SnapshotSummary>, String> {
    crate::access_protection::list(&AppType::from_str(&app).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn restore_access_snapshot(
    handle: tauri::AppHandle,
    app: String,
    id: String,
) -> Result<(), String> {
    use tauri::{Emitter, Manager};
    tauri::async_runtime::spawn_blocking(move || {
        let state = handle.state::<AppState>();
        crate::access_protection::restore(&state, &AppType::from_str(&app).map_err(|e| e.to_string())?, &id).map_err(|e| e.to_string())?;
        let _ = handle.emit("provider-switched", json!({"appType":app,"providerId":crate::services::ProviderService::current(&state, AppType::from_str(&app).unwrap()).unwrap_or_default()}));
        Ok(())
    }).await.map_err(|e| e.to_string())?
}
