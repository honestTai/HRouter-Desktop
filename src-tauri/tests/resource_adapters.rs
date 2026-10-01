//! Native files, DB flags and resource snapshots must agree. All writes use an isolated test home.
use cc_switch_lib::{McpApps, McpServer, McpService, ResourceTarget};
use serde_json::json;
#[path = "support.rs"]
mod support;
use support::{create_test_state, ensure_test_home, reset_test_fs, test_mutex};
fn server(id: &str) -> McpServer {
    McpServer {
        id: id.into(),
        name: id.into(),
        server: json!({"type":"stdio","command":"echo","args":["hello"]}),
        apps: McpApps::default(),
        description: None,
        homepage: None,
        docs: None,
        tags: vec![],
    }
}

#[test]
fn extra_mcp_adapters_write_real_configs_and_disable_only_the_selected_client() {
    let _guard = test_mutex().lock().unwrap();
    reset_test_fs();
    let home = ensure_test_home();
    let state = create_test_state().unwrap();
    let mut row = server("all-clients");
    let mut targets = vec![
        ResourceTarget::Pi,
        ResourceTarget::OpenClaw,
        ResourceTarget::DeepseekHarness,
        ResourceTarget::Workbuddy,
    ];
    if cfg!(any(target_os = "macos", windows)) {
        targets.push(ResourceTarget::ClaudeDesktop);
    }
    for target in &targets {
        row.apps.set_enabled_for(target, true);
    }
    McpService::upsert_server(&state, row).unwrap();
    for (path, pointer) in [
        (".pi/agent/mcp.json", "/mcpServers/all-clients/command"),
        (".codebuddy/.mcp.json", "/mcpServers/all-clients/command"),
        (
            ".openclaw/openclaw.json",
            "/mcp/servers/all-clients/command",
        ),
    ] {
        let data = std::fs::read_to_string(home.join(path)).unwrap();
        let doc: serde_json::Value = json5::from_str(&data).unwrap();
        assert_eq!(doc.pointer(pointer).unwrap(), "echo");
    }
    let harness = std::fs::read_to_string(home.join(".dsh/cordis.patch.yml")).unwrap();
    assert!(harness.contains("@deepseek-ai/dsh-mcp-client"));
    assert!(harness.contains("serverName: all-clients"));
    #[cfg(target_os = "macos")]
    assert!(std::fs::read_to_string(
        home.join("Library/Application Support/Claude/claude_desktop_config.json")
    )
    .unwrap()
    .contains("all-clients"));
    McpService::toggle_app(&state, "all-clients", ResourceTarget::Pi, false).unwrap();
    let row = state
        .db
        .get_all_mcp_servers()
        .unwrap()
        .shift_remove("all-clients")
        .unwrap();
    assert!(!row.apps.pi);
    for target in targets.into_iter().filter(|t| *t != ResourceTarget::Pi) {
        assert!(row.apps.is_enabled_for(&target));
    }
    let doc: serde_json::Value =
        serde_json::from_slice(&std::fs::read(home.join(".pi/agent/mcp.json")).unwrap()).unwrap();
    assert!(doc["mcpServers"].get("all-clients").is_none());
}

#[test]
fn global_projection_does_not_delete_unmanaged_servers_in_new_clients() {
    let _guard = test_mutex().lock().unwrap();
    reset_test_fs();
    let home = ensure_test_home();
    let state = create_test_state().unwrap();
    std::fs::create_dir_all(home.join(".pi/agent")).unwrap();
    let original = br#"{"mcpServers":{"foreign":{"command":"keep"}}}"#;
    std::fs::write(home.join(".pi/agent/mcp.json"), original).unwrap();
    state.db.save_mcp_server(&server("foreign")).unwrap();
    McpService::sync_all_enabled(&state).unwrap();
    assert_eq!(
        std::fs::read(home.join(".pi/agent/mcp.json")).unwrap(),
        original
    );
}

#[test]
fn malformed_native_target_is_rejected_before_database_or_other_clients_are_changed() {
    let _guard = test_mutex().lock().unwrap();
    reset_test_fs();
    let home = ensure_test_home();
    let state = create_test_state().unwrap();
    std::fs::create_dir_all(home.join(".codebuddy")).unwrap();
    std::fs::write(home.join(".codebuddy/.mcp.json"), "{ broken").unwrap();
    let mut row = server("new-server");
    row.apps.pi = true;
    row.apps.workbuddy = true;
    assert!(McpService::upsert_server(&state, row).is_err());
    assert!(state.db.get_all_mcp_servers().unwrap().is_empty());
    assert!(!home.join(".pi/agent/mcp.json").exists());
    assert_eq!(
        std::fs::read_to_string(home.join(".codebuddy/.mcp.json")).unwrap(),
        "{ broken"
    );
}
