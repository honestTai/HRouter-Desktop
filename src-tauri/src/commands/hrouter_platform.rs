//! HRouter.net 用户平台接口。
//!
//! Desktop 只代理固定的用户端 API，避免 WebView 跨域，同时明确隔离账户会话与
//! 本地 Agent 使用的 Provider Key。

use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, time::Duration};

const HROUTER_API_BASE_URL: &str = "https://hrouter.net/api/v1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HRouterPlatformRequest {
    pub method: String,
    pub path: String,
    pub query: Option<HashMap<String, String>>,
    pub body: Option<Value>,
    pub access_token: Option<String>,
    pub locale: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HRouterPlatformResponse {
    pub status: u16,
    pub data: Value,
}

fn is_numeric_path(path: &str, prefix: &str, suffix: &str) -> bool {
    path.strip_prefix(prefix)
        .and_then(|rest| rest.strip_suffix(suffix))
        .is_some_and(|id| !id.is_empty() && id.chars().all(|character| character.is_ascii_digit()))
}

fn is_allowed_request(method: &Method, path: &str) -> bool {
    match (method, path) {
        (&Method::GET, "/settings/public")
        | (&Method::POST, "/auth/login")
        | (&Method::POST, "/auth/register")
        | (&Method::POST, "/auth/send-verify-code")
        | (&Method::POST, "/auth/refresh")
        | (&Method::POST, "/auth/logout")
        | (&Method::GET, "/auth/me")
        | (&Method::GET, "/user/profile")
        | (&Method::GET, "/usage")
        | (&Method::GET, "/usage/stats")
        | (&Method::GET, "/usage/dashboard/stats")
        | (&Method::GET, "/usage/dashboard/models")
        | (&Method::GET, "/groups/available")
        | (&Method::GET, "/keys")
        | (&Method::POST, "/keys")
        | (&Method::GET, "/model-plaza")
        | (&Method::GET, "/user/aff")
        | (&Method::POST, "/user/aff/transfer")
        | (&Method::POST, "/redeem")
        | (&Method::PUT, "/user")
        | (&Method::PUT, "/user/password")
        | (&Method::GET, "/payment/checkout-info")
        | (&Method::GET, "/payment/orders/my")
        | (&Method::POST, "/payment/orders")
        | (&Method::POST, "/payment/orders/verify")
        | (&Method::GET, "/announcements") => true,
        (&Method::GET | &Method::PUT | &Method::DELETE, path)
            if is_numeric_path(path, "/keys/", "") =>
        {
            true
        }
        (&Method::POST, path) if is_numeric_path(path, "/payment/orders/", "/cancel") => true,
        (&Method::POST, path) if is_numeric_path(path, "/announcements/", "/read") => true,
        _ => false,
    }
}

fn is_public_request(method: &Method, path: &str) -> bool {
    matches!(
        (method, path),
        (&Method::GET, "/settings/public")
            | (&Method::POST, "/auth/login")
            | (&Method::POST, "/auth/register")
            | (&Method::POST, "/auth/send-verify-code")
            | (&Method::POST, "/auth/refresh")
            | (&Method::GET, "/announcements")
    )
}

fn parse_method(value: &str) -> Result<Method, String> {
    match value.trim().to_ascii_uppercase().as_str() {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "DELETE" => Ok(Method::DELETE),
        _ => Err("不支持的 HRouter 请求方法".to_string()),
    }
}

#[tauri::command]
pub async fn hrouter_platform_request(
    request: HRouterPlatformRequest,
) -> Result<HRouterPlatformResponse, String> {
    let method = parse_method(&request.method)?;
    if !is_allowed_request(&method, &request.path) {
        return Err("不允许访问该 HRouter 接口".to_string());
    }
    if !is_public_request(&method, &request.path)
        && request
            .access_token
            .as_deref()
            .is_none_or(|token| token.trim().is_empty())
    {
        return Ok(HRouterPlatformResponse {
            status: 401,
            data: json!({
                "code": "DESKTOP_AUTH_REQUIRED",
                "message": "请先登录 HRouter"
            }),
        });
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("创建 HRouter 请求失败: {error}"))?;
    let url = format!("{HROUTER_API_BASE_URL}{}", request.path);
    let mut builder = client
        .request(method, url)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header("X-User-UI-Request", "1")
        .header(
            reqwest::header::USER_AGENT,
            concat!("HRouter-Desktop/", env!("CARGO_PKG_VERSION")),
        );

    if let Some(locale) = request.locale.filter(|locale| !locale.trim().is_empty()) {
        builder = builder.header(reqwest::header::ACCEPT_LANGUAGE, locale);
    }
    if let Some(query) = request.query {
        builder = builder.query(&query);
    }
    if let Some(body) = request.body {
        builder = builder.json(&body);
    }
    if let Some(token) = request
        .access_token
        .filter(|token| !token.trim().is_empty())
    {
        builder = builder.bearer_auth(token);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("连接 HRouter.net 失败: {error}"))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 HRouter.net 响应失败: {error}"))?;
    let data = serde_json::from_str(&body).unwrap_or_else(|_| json!({ "message": body }));

    Ok(HRouterPlatformResponse { status, data })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_allows_user_platform_routes() {
        let fixed_routes = [
            (Method::POST, "/auth/login"),
            (Method::GET, "/usage"),
            (Method::GET, "/usage/stats"),
            (Method::GET, "/groups/available"),
            (Method::GET, "/model-plaza"),
            (Method::GET, "/user/aff"),
            (Method::POST, "/user/aff/transfer"),
            (Method::POST, "/redeem"),
            (Method::PUT, "/user"),
            (Method::PUT, "/user/password"),
        ];
        for (method, path) in fixed_routes {
            assert!(
                is_allowed_request(&method, path),
                "expected {method} {path} to be allowed"
            );
        }
        assert!(is_allowed_request(&Method::PUT, "/keys/42"));
        assert!(is_allowed_request(
            &Method::POST,
            "/payment/orders/18/cancel"
        ));
        assert!(!is_allowed_request(&Method::GET, "/admin/users"));
        assert!(!is_allowed_request(&Method::DELETE, "/keys/all"));
        assert!(!is_allowed_request(&Method::GET, "https://example.com"));
    }

    #[test]
    fn announcements_are_public_but_account_data_is_not() {
        assert!(is_public_request(&Method::GET, "/announcements"));
        assert!(is_public_request(&Method::POST, "/auth/register"));
        assert!(!is_public_request(&Method::GET, "/keys"));
        assert!(!is_public_request(&Method::GET, "/usage/dashboard/stats"));
    }
}
