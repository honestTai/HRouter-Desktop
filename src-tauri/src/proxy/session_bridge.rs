//! Opt-in, in-memory replay. Never rewrites session files or auth state.
use super::ProxyError;
use serde_json::Value;

pub fn prepare_stateless_replay(body: &mut Value) -> Result<(), ProxyError> {
    let has_previous = body
        .get("previous_response_id")
        .is_some_and(|v| !v.is_null());
    let has_context = body
        .get("input")
        .and_then(Value::as_array)
        .is_some_and(|items| {
            // A single new user message (or string input) is a valid incremental
            // continuation, not evidence that the previous history was replayed.
            items
                .iter()
                .any(|i| i.get("role").and_then(Value::as_str) == Some("user"))
                && items.iter().any(|i| {
                    i.get("role").and_then(Value::as_str) == Some("assistant")
                        || i.get("type").and_then(Value::as_str) == Some("function_call")
                })
        });
    // A previous_response_id is not portable. Refuse to silently discard context
    // when the client supplied only a continuation/reference.
    if has_previous && !has_context {
        return Err(ProxyError::InvalidRequest("跨供应商续聊需要完整消息历史；请重新打开旧会话，让客户端重发上下文。仅 previous_response_id 无法恢复原服务端上下文。".into()));
    }
    if let Some(object) = body.as_object_mut() {
        object.remove("previous_response_id");
    }
    if let Some(items) = body.get_mut("input").and_then(Value::as_array_mut) {
        if items
            .iter()
            .any(|i| i.get("type").and_then(Value::as_str) == Some("item_reference"))
        {
            return Err(ProxyError::InvalidRequest(
                "旧会话含服务端 item_reference；需要客户端重发完整历史，无法仅凭引用跨供应商续聊。"
                    .into(),
            ));
        }
        items.retain_mut(|item| {
            if let Some(object) = item.as_object_mut() {
                object.remove("id");
                object.remove("encrypted_content");
                if object.get("type").and_then(Value::as_str) == Some("reasoning") {
                    // Hidden reasoning belongs to its issuing provider. Explicitly
                    // selected compatibility mode keeps visible history and tools.
                    return false;
                }
            }
            true
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn keeps_messages_and_tool_pairs_without_foreign_state() {
        let original = json!({"previous_response_id":"resp_old","input":[
            {"id":"bad_id","role":"user","content":"继续"},
            {"id":"rs_old","type":"reasoning","encrypted_content":"private"},
            {"id":"fc_old","type":"function_call","call_id":"call_1","name":"read","arguments":"{}"},
            {"type":"function_call_output","call_id":"call_1","output":"ok"}]});
        let mut request = original.clone();
        prepare_stateless_replay(&mut request).unwrap();
        assert!(request.get("previous_response_id").is_none());
        assert_eq!(request["input"].as_array().unwrap().len(), 3);
        assert_eq!(
            request["input"][1]["call_id"],
            request["input"][2]["call_id"]
        );
        assert_eq!(original["input"][0]["id"], "bad_id");
        let once = request.clone();
        prepare_stateless_replay(&mut request).unwrap();
        assert_eq!(once, request);
    }
    #[test]
    fn rejects_missing_history_instead_of_losing_it() {
        assert!(prepare_stateless_replay(
            &mut json!({"previous_response_id":"old","input":"continue"})
        )
        .is_err());
        assert!(prepare_stateless_replay(&mut json!({"previous_response_id":"old","input":[{"role":"user","content":"continue"}]})).is_err());
        assert!(prepare_stateless_replay(&mut json!({"previous_response_id":"old","input":[{"type":"function_call_output","output":"ok"}]})).is_err());
        assert!(prepare_stateless_replay(
            &mut json!({"input":[{"type":"item_reference","id":"old"}]})
        )
        .is_err());
    }
}
