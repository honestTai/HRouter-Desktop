import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "./types";

export interface DiagnosticReport {
  testedAt: number;
  model: string;
  protocol: string;
  models: string[];
  steps: {
    name: string;
    status: "passed" | "failed" | "skipped";
    message: string;
    elapsedMs: number;
  }[];
}
export interface ImportCandidate {
  id: string;
  app: string;
  name: string;
  exists: boolean;
}
export interface SwitchPreview {
  fingerprint: string;
  protected: boolean;
  fields: string[];
  files: string[];
}
export interface AccessSnapshot {
  id: string;
  createdAt: number;
  previousProvider: string | null;
  nextProvider: string | null;
  canRestore: boolean;
}
export interface EnvironmentTarget {
  name: string;
  app: string;
  directory: string;
  providerId: string;
}

export const accessApi = {
  rebuildOpenCode: () =>
    invoke<{ imported: number; errors: string[] }>("rebuild_opencode_usage"),
  environmentTargets: () =>
    invoke<EnvironmentTarget[]>("get_environment_targets"),
  saveEnvironmentTargets: (targets: EnvironmentTarget[]) =>
    invoke<void>("save_environment_targets", { targets }),
  previewEnvironmentTargets: (targets: EnvironmentTarget[]) =>
    invoke<{ fingerprint: string; files: string[] }>(
      "preview_environment_targets",
      { targets },
    ),
  applyEnvironmentTargets: (
    targets: EnvironmentTarget[],
    fingerprint: string,
  ) => invoke<string>("apply_environment_targets", { targets, fingerprint }),
  liteMode: () => invoke<boolean>("get_lite_mode"),
  setLiteMode: (enabled: boolean) => invoke<void>("set_lite_mode", { enabled }),
  providersOnlySync: () => invoke<boolean>("get_providers_only_sync"),
  setProvidersOnlySync: (enabled: boolean) =>
    invoke<void>("set_providers_only_sync", { enabled }),
  modelRoutes: (app: AppId) =>
    invoke<{ model: string; providers: string[] }[]>("get_model_routes", {
      app,
    }),
  setModelRoutes: (
    app: AppId,
    routes: { model: string; providers: string[] }[],
  ) => invoke<void>("set_model_routes", { app, routes }),
  setCompatibility: (
    app: AppId,
    id: string,
    sessionBridge: boolean,
    standardHttp: boolean,
  ) =>
    invoke<void>("set_provider_compatibility", {
      app,
      id,
      sessionBridge,
      standardHttp,
    }),
  promptProtection: (app: AppId) =>
    invoke<boolean>("get_prompt_protection", { app }),
  setPromptProtection: (app: AppId, enabled: boolean) =>
    invoke<void>("set_prompt_protection", { app, enabled }),
  diagnose: (app: AppId, id: string, model: string, allowPaid: boolean) =>
    invoke<DiagnosticReport>("diagnose_provider", {
      app,
      id,
      model,
      allowPaid,
    }),
  previewImport: (path: string) =>
    invoke<ImportCandidate[]>("preview_cc_switch_import", { path }),
  importProviders: (path: string, selected: string[]) =>
    invoke<number>("import_cc_switch_providers", { path, selected }),
  protection: (app: AppId) => invoke<boolean>("get_access_protection", { app }),
  setProtection: (app: AppId, enabled: boolean) =>
    invoke<void>("set_access_protection", { app, enabled }),
  preview: (app: AppId, id: string) =>
    invoke<SwitchPreview>("preview_access_switch", { app, id }),
  switch: (app: AppId, id: string, expectedFingerprint: string) =>
    invoke<{ warnings: string[] }>("switch_provider", {
      app,
      id,
      expectedFingerprint,
    }),
  snapshots: (app: AppId) =>
    invoke<AccessSnapshot[]>("list_access_snapshots", { app }),
  restore: (app: AppId, id: string) =>
    invoke<void>("restore_access_snapshot", { app, id }),
};
