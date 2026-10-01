import type { AppId } from "@/lib/api/types";
export type FileAgentId = Extract<
  AppId,
  "pi" | "deepseek-harness" | "workbuddy"
>;
export function isFileAgent(app: string): app is FileAgentId {
  return app === "pi" || app === "deepseek-harness" || app === "workbuddy";
}
export const FILE_AGENT_NAMES: Record<FileAgentId, string> = {
  pi: "Pi Agent",
  "deepseek-harness": "DeepSeek Harness",
  workbuddy: "WorkBuddy",
};
export const FILE_AGENT_ICONS: Record<FileAgentId, string> = {
  pi: "pi",
  "deepseek-harness": "deepseek",
  workbuddy: "workbuddy",
};
