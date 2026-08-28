import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type WorkspaceTool = "claude" | "codex" | "terminal";

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
}

export const embeddedTerminalApi = {
  async openWorkspace(): Promise<string> {
    return await invoke("open_terminal_workspace_window");
  },

  async start(options: {
    sessionId: string;
    tool: WorkspaceTool;
    cwd?: string | null;
    cols: number;
    rows: number;
  }): Promise<boolean> {
    return await invoke("start_embedded_terminal", { request: options });
  },

  async write(sessionId: string, data: Uint8Array): Promise<void> {
    await invoke("write_embedded_terminal", {
      sessionId,
      data: Array.from(data),
    });
  },

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    await invoke("resize_embedded_terminal", { sessionId, cols, rows });
  },

  async stop(sessionId: string): Promise<void> {
    await invoke("stop_embedded_terminal", { sessionId });
  },

  async onOutput(
    handler: (payload: TerminalOutputEvent) => void,
  ): Promise<UnlistenFn> {
    return await listen<TerminalOutputEvent>(
      "embedded-terminal-output",
      (event) => handler(event.payload),
    );
  },

  async onExit(
    handler: (payload: TerminalExitEvent) => void,
  ): Promise<UnlistenFn> {
    return await listen<TerminalExitEvent>("embedded-terminal-exit", (event) =>
      handler(event.payload),
    );
  },
};
