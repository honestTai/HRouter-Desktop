import { invoke } from "@tauri-apps/api/core";
export interface PiConnection {
  baseUrl: string;
  model: string;
  api: "openai-completions" | "openai-responses" | "anthropic-messages";
  credentialMode: "env" | "literal";
  credential: string;
}
export interface PiPreview {
  path: string;
  fingerprint: string;
  existed: boolean;
  updatingProvider: boolean;
  modelCount: number;
}
export const externalAgentsApi = {
  previewPi: (input: PiConnection) =>
    invoke<PiPreview>("preview_pi_connection", { input }),
  applyPi: (input: PiConnection, fingerprint: string) =>
    invoke<{ path: string; backupPath: string | null }>("apply_pi_connection", {
      input,
      fingerprint,
    }),
};
