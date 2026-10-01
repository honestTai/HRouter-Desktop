import type { PiConnection } from "@/lib/api/externalAgents";
export type ExtraAgent = "pi" | "deepseek-harness" | "workbuddy";
export const EXTRA_AGENTS = [
  {
    id: "pi",
    name: "Pi Agent",
    mark: "π",
    url: "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md",
  },
  {
    id: "deepseek-harness",
    name: "DeepSeek Harness",
    mark: "DS",
    url: "https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-pi-ai/README.md",
  },
  {
    id: "workbuddy",
    name: "WorkBuddy",
    mark: "W",
    url: "https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model",
  },
] as const;
export function validConnection(
  input: PiConnection,
  agent: ExtraAgent,
): boolean {
  try {
    const url = new URL(input.baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      return false;
    if (
      !input.model.trim() ||
      input.model.length > 256 ||
      /[\r\n\x00-\x1f]/.test(input.model)
    )
      return false;
    if (
      ![
        "openai-completions",
        "openai-responses",
        "anthropic-messages",
      ].includes(input.api)
    )
      return false;
    if (agent === "workbuddy" && input.api !== "openai-completions")
      return false;
    if (input.credentialMode === "keep") return true;
    if (agent === "workbuddy")
      return (
        input.api === "openai-completions" &&
        input.credentialMode === "literal" &&
        !!input.credential.trim() &&
        input.credential.length <= 8192 &&
        !/[\x00-\x1f]/.test(input.credential)
      );
    if (input.credentialMode === "env")
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(input.credential);
    if (agent === "deepseek-harness" && input.credentialMode === "literal")
      return (
        !!input.credential.trim() &&
        input.credential.length <= 8192 &&
        !/[\x00-\x1f']/.test(input.credential)
      );
    return (
      agent === "pi" &&
      !!input.credential.trim() &&
      input.credential.length <= 8192 &&
      !input.credential.trim().startsWith("!") &&
      !/[$\x00-\x1f]/.test(input.credential)
    );
  } catch {
    return false;
  }
}
