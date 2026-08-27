use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{Arc, Mutex},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State, WebviewUrl, WebviewWindowBuilder};

use crate::{app_config::AppType, services::ProviderService, store::AppState};

#[cfg(target_os = "windows")]
use super::misc::effective_path_string;
use super::misc::{extract_env_vars_from_config, resolve_launch_cwd};

const OUTPUT_EVENT: &str = "embedded-terminal-output";
const EXIT_EVENT: &str = "embedded-terminal-exit";

pub struct EmbeddedTerminalSession {
    owner_label: String,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Box<dyn portable_pty::ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct EmbeddedTerminalState {
    sessions: Mutex<HashMap<String, EmbeddedTerminalSession>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartEmbeddedTerminalRequest {
    session_id: String,
    provider_id: String,
    app: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    session_id: String,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    session_id: String,
}

fn agent_command(app: &AppType) -> Result<&'static str, String> {
    match app {
        AppType::Claude | AppType::ClaudeDesktop => Ok("claude"),
        AppType::Codex => Ok("codex"),
        AppType::Gemini => Ok("gemini"),
        AppType::GrokBuild => Ok("grok"),
        AppType::OpenCode => Ok("opencode"),
        AppType::OpenClaw => Ok("openclaw"),
        AppType::Hermes => Ok("hermes"),
    }
}

fn agent_shell_command(app: &AppType) -> Result<CommandBuilder, String> {
    #[cfg(target_os = "windows")]
    {
        let shell = std::env::var_os("SystemRoot")
            .map(std::path::PathBuf::from)
            .map(|root| {
                root.join("System32")
                    .join("WindowsPowerShell")
                    .join("v1.0")
                    .join("powershell.exe")
            })
            .filter(|path| path.is_file())
            .unwrap_or_else(|| std::path::PathBuf::from("powershell.exe"));
        let mut command = CommandBuilder::new(shell);
        command.args(["-NoLogo", "-NoExit"]);
        command.args(["-Command", agent_command(app)?]);
        Ok(command)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|value| value.starts_with('/') && !value.contains(['\r', '\n']))
            .unwrap_or_else(|| "/bin/zsh".to_string());
        let mut command = CommandBuilder::new(shell);
        command.args(["-lic", &format!("exec {}", agent_command(app)?)]);
        Ok(command)
    }
}

#[cfg(target_os = "windows")]
fn windows_terminal_path() -> Option<std::ffi::OsString> {
    let mut paths = Vec::new();
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let local_app_data = std::path::PathBuf::from(local_app_data);
        paths.push(local_app_data.join("Microsoft").join("WindowsApps"));
        paths.push(
            local_app_data
                .join("Programs")
                .join("OpenAI")
                .join("Codex")
                .join("bin"),
        );
        paths.push(local_app_data.join("Programs").join("claude"));
    }
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        paths.push(std::path::PathBuf::from(program_files).join("nodejs"));
    }
    if let Some(app_data) = std::env::var_os("APPDATA") {
        paths.push(std::path::PathBuf::from(app_data).join("npm"));
    }
    paths.extend(std::env::split_paths(std::ffi::OsStr::new(
        &effective_path_string(),
    )));
    std::env::join_paths(paths).ok()
}

fn validate_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.clamp(2, 500),
        cols: cols.clamp(2, 500),
        pixel_width: 0,
        pixel_height: 0,
    }
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn open_terminal_workspace_window(
    app_handle: AppHandle,
    app_state: State<'_, AppState>,
    providerId: String,
    app: String,
    cwd: String,
) -> Result<String, String> {
    let app_type: AppType = app
        .parse()
        .map_err(|error: crate::AppError| error.to_string())?;
    let launch_cwd = resolve_launch_cwd(Some(cwd))?.ok_or_else(|| "请选择工作目录".to_string())?;
    let providers = ProviderService::list(app_state.inner(), app_type)
        .map_err(|error| format!("获取提供商列表失败: {error}"))?;
    let provider = providers
        .get(&providerId)
        .ok_or_else(|| format!("提供商 {providerId} 不存在"))?;
    let label = format!("terminal-{}", uuid::Uuid::new_v4().simple());
    let query = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("terminalWorkspace", "1")
        .append_pair("app", &app)
        .append_pair("providerId", &providerId)
        .append_pair("providerName", &provider.name)
        .append_pair("cwd", &launch_cwd.to_string_lossy())
        .finish();

    WebviewWindowBuilder::new(
        &app_handle,
        &label,
        WebviewUrl::App(format!("index.html?{query}").into()),
    )
    .title(format!("{} CLI - HRouter", provider.name))
    .inner_size(1120.0, 720.0)
    .min_inner_size(760.0, 480.0)
    .center()
    .build()
    .map_err(|error| format!("创建 CLI 窗口失败: {error}"))?;

    Ok(label)
}

#[tauri::command]
pub async fn start_embedded_terminal(
    app_handle: AppHandle,
    window: tauri::WebviewWindow,
    app_state: State<'_, AppState>,
    terminal_state: State<'_, EmbeddedTerminalState>,
    request: StartEmbeddedTerminalRequest,
) -> Result<bool, String> {
    let StartEmbeddedTerminalRequest {
        session_id,
        provider_id,
        app,
        cwd,
        cols,
        rows,
    } = request;
    if session_id.trim().is_empty() || session_id.len() > 128 {
        return Err("Invalid terminal session id".to_string());
    }
    let app_type: AppType = app
        .parse()
        .map_err(|error: crate::AppError| error.to_string())?;
    let launch_cwd = resolve_launch_cwd(cwd)?;
    let providers = ProviderService::list(app_state.inner(), app_type.clone())
        .map_err(|error| format!("获取提供商列表失败: {error}"))?;
    let provider = providers
        .get(&provider_id)
        .ok_or_else(|| format!("提供商 {provider_id} 不存在"))?;
    let env_vars = extract_env_vars_from_config(&provider.settings_config, &app_type);

    stop_session(&terminal_state, &session_id);

    let pair = native_pty_system()
        .openpty(validate_size(cols, rows))
        .map_err(|error| format!("创建 PTY 失败: {error}"))?;
    let mut command = agent_shell_command(&app_type)?;
    if let Some(path) = launch_cwd {
        command.cwd(path);
    }
    for (key, value) in env_vars {
        command.env(key, value);
    }
    #[cfg(target_os = "windows")]
    if let Some(path) = windows_terminal_path() {
        command.env("PATH", path);
    }
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("启动终端进程失败: {error}"))?;
    let killer = child.clone_killer();
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("读取 PTY 失败: {error}"))?;
    let writer = Arc::new(Mutex::new(
        pair.master
            .take_writer()
            .map_err(|error| format!("写入 PTY 失败: {error}"))?,
    ));

    terminal_state
        .sessions
        .lock()
        .map_err(|_| "终端状态锁已损坏".to_string())?
        .insert(
            session_id.clone(),
            EmbeddedTerminalSession {
                owner_label: window.label().to_string(),
                master: pair.master,
                writer,
                killer,
            },
        );

    let output_app_handle = app_handle.clone();
    let output_session_id = session_id.clone();
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => {
                    let _ = output_app_handle.emit(
                        OUTPUT_EVENT,
                        TerminalOutputPayload {
                            session_id: output_session_id.clone(),
                            data: BASE64.encode(&buffer[..read]),
                        },
                    );
                }
            }
        }
    });

    std::thread::spawn(move || {
        let _ = child.wait();
        let _ = app_handle.emit(EXIT_EVENT, TerminalExitPayload { session_id });
    });

    Ok(true)
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn write_embedded_terminal(
    state: State<'_, EmbeddedTerminalState>,
    sessionId: String,
    data: Vec<u8>,
) -> Result<(), String> {
    if data.len() > 64 * 1024 {
        return Err("Terminal input is too large".to_string());
    }
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "终端状态锁已损坏".to_string())?;
    let session = sessions
        .get(&sessionId)
        .ok_or_else(|| "终端会话不存在".to_string())?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| "终端写入锁已损坏".to_string())?;
    writer
        .write_all(&data)
        .and_then(|_| writer.flush())
        .map_err(|error| format!("写入终端失败: {error}"))
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn resize_embedded_terminal(
    state: State<'_, EmbeddedTerminalState>,
    sessionId: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "终端状态锁已损坏".to_string())?;
    let session = sessions
        .get(&sessionId)
        .ok_or_else(|| "终端会话不存在".to_string())?;
    session
        .master
        .resize(validate_size(cols, rows))
        .map_err(|error| format!("调整终端尺寸失败: {error}"))
}

fn stop_session(state: &EmbeddedTerminalState, session_id: &str) {
    let Ok(mut sessions) = state.sessions.lock() else {
        return;
    };
    if let Some(mut session) = sessions.remove(session_id) {
        let _ = session.killer.kill();
    }
}

pub fn stop_embedded_terminals_for_window(state: &EmbeddedTerminalState, window_label: &str) {
    let Ok(mut sessions) = state.sessions.lock() else {
        return;
    };
    let owned_ids = sessions
        .iter()
        .filter(|(_, session)| session.owner_label == window_label)
        .map(|(session_id, _)| session_id.clone())
        .collect::<Vec<_>>();
    for session_id in owned_ids {
        if let Some(mut session) = sessions.remove(&session_id) {
            let _ = session.killer.kill();
        }
    }
}

#[allow(non_snake_case)]
#[tauri::command]
pub async fn stop_embedded_terminal(
    state: State<'_, EmbeddedTerminalState>,
    sessionId: String,
) -> Result<(), String> {
    stop_session(&state, &sessionId);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_terminal_dimensions() {
        let size = validate_size(0, u16::MAX);
        assert_eq!(size.cols, 2);
        assert_eq!(size.rows, 500);
    }

    #[test]
    fn maps_supported_agents_to_fixed_commands() {
        assert_eq!(agent_command(&AppType::Claude).unwrap(), "claude");
        assert_eq!(agent_command(&AppType::Codex).unwrap(), "codex");
        assert_eq!(agent_command(&AppType::Gemini).unwrap(), "gemini");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn terminal_path_includes_node_and_global_npm_locations() {
        let path = windows_terminal_path().expect("terminal PATH should be constructible");
        let paths = std::env::split_paths(&path).collect::<Vec<_>>();
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            assert!(paths.contains(&std::path::PathBuf::from(program_files).join("nodejs")));
        }
        if let Some(app_data) = std::env::var_os("APPDATA") {
            assert!(paths.contains(&std::path::PathBuf::from(app_data).join("npm")));
        }
    }

    #[test]
    fn native_pty_runs_the_platform_shell() {
        let pair = native_pty_system()
            .openpty(validate_size(80, 24))
            .expect("native PTY should be available");

        #[cfg(target_os = "windows")]
        let command = {
            let mut command = CommandBuilder::new("powershell.exe");
            command.args(["-NoLogo", "-NoProfile", "-NoExit"]);
            command
        };

        #[cfg(not(target_os = "windows"))]
        let command = {
            let mut command = CommandBuilder::new("/bin/sh");
            command.arg("-i");
            command
        };

        let mut reader = pair
            .master
            .try_clone_reader()
            .expect("PTY output should be readable");
        let mut writer = pair
            .master
            .take_writer()
            .expect("PTY input should be writable");
        let mut child = pair
            .slave
            .spawn_command(command)
            .expect("platform shell should start inside the PTY");
        let mut killer = child.clone_killer();
        drop(pair.slave);

        let (output_sender, output_receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut buffer = [0_u8; 1024];
            while let Ok(read) = reader.read(&mut buffer) {
                if read == 0 {
                    break;
                }
                if output_sender.send(buffer[..read].to_vec()).is_err() {
                    break;
                }
            }
        });

        #[cfg(target_os = "windows")]
        {
            let handshake = output_receiver
                .recv_timeout(std::time::Duration::from_secs(5))
                .expect("ConPTY should request the initial cursor position");
            assert!(
                handshake
                    .windows(b"\x1b[6n".len())
                    .any(|bytes| bytes == b"\x1b[6n"),
                "unexpected ConPTY handshake: {:?}",
                String::from_utf8_lossy(&handshake)
            );
            writer
                .write_all(b"\x1b[1;1R")
                .expect("ConPTY cursor response should be written to the PTY");
            writer
                .flush()
                .expect("ConPTY cursor response should be flushed");
        }

        #[cfg(target_os = "windows")]
        writer
            .write_all(b"Write-Output ('HROUTER_PTY_' + 'SMOKE_RESULT')\r")
            .expect("PowerShell command should be written to the PTY");
        #[cfg(not(target_os = "windows"))]
        writer
            .write_all(b"printf 'HROUTER_PTY_%s' 'SMOKE_RESULT'\n")
            .expect("shell command should be written to the PTY");
        writer.flush().expect("PTY input should be flushed");

        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        let mut output = Vec::new();
        while std::time::Instant::now() < deadline {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            let Ok(chunk) = output_receiver.recv_timeout(remaining) else {
                break;
            };
            output.extend_from_slice(&chunk);
            if output
                .windows(b"HROUTER_PTY_SMOKE_RESULT".len())
                .any(|bytes| bytes == b"HROUTER_PTY_SMOKE_RESULT")
            {
                break;
            }
        }
        let _ = killer.kill();
        let wait_result = child.wait();
        let output = String::from_utf8_lossy(&output);
        assert!(
            output.contains("HROUTER_PTY_SMOKE_RESULT"),
            "unexpected PTY output: {output:?}"
        );
        wait_result.expect("platform shell should be reaped");
    }
}
