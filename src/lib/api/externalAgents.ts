import { invoke } from "@tauri-apps/api/core";
export type FileAgentId = "pi" | "deepseek-harness" | "workbuddy";
export interface PiConnection {
  baseUrl: string;
  model: string;
  api: "openai-completions" | "openai-responses" | "anthropic-messages";
  credentialMode: "env" | "literal" | "keep";
  credential: string;
}
export interface PiPreview {
  path: string;
  fingerprint: string;
  existed: boolean;
  updatingProvider: boolean;
  modelCount: number;
}
export interface AgentConfigState {
  path: string;
  existed: boolean;
  connections: PiConnection[];
}
export interface AgentConfigApplied {
  path: string;
  backupPath: string | null;
}
export const externalAgentsApi = {
  inspect: (agent: FileAgentId) =>
    invoke<AgentConfigState>("inspect_agent_config", { agent }),
  preview: (agent: FileAgentId, input: PiConnection) =>
    invoke<PiPreview>("preview_agent_config", { agent, input }),
  apply: (agent: FileAgentId, input: PiConnection, fingerprint: string) =>
    invoke<AgentConfigApplied>("apply_agent_config", {
      agent,
      input,
      fingerprint,
    }),
  previewPi: (input: PiConnection) =>
    invoke<PiPreview>("preview_pi_connection", { input }),
  applyPi: (input: PiConnection, fingerprint: string) =>
    invoke<AgentConfigApplied>("apply_pi_connection", { input, fingerprint }),
};
