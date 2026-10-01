import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { settingsApi } from "@/lib/api";
import {
  externalAgentsApi,
  type PiConnection,
  type PiPreview,
} from "@/lib/api/externalAgents";
import {
  EXTRA_AGENTS,
  deepseekSnippet,
  validConnection,
  type ExtraAgent,
} from "./connectionTemplates";
import { extractErrorMessage } from "@/utils/errorUtils";

export function ExtraAgentConnections() {
  const { t } = useTranslation();
  const [agent, setAgent] = useState<ExtraAgent | null>(null);
  return (
    <section aria-label={t("extraAgents.title")} className="w-full space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-medium text-muted-foreground">
          {t("extraAgents.title")}
        </h2>
        <div className="h-px flex-1 bg-border/70" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {EXTRA_AGENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAgent(item.id)}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              {item.mark}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {item.name}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {t(`extraAgents.${item.mode}`)}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      {agent && (
        <ConnectionDialog
          key={agent}
          agent={agent}
          onClose={() => setAgent(null)}
        />
      )}
    </section>
  );
}
function ConnectionDialog({
  agent,
  onClose,
}: {
  agent: ExtraAgent;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const info = EXTRA_AGENTS.find((a) => a.id === agent)!;
  const [input, setInput] = useState<PiConnection>({
    baseUrl: "",
    model: "",
    api: "openai-completions",
    credentialMode: "env",
    credential: "HROUTER_API_KEY",
  });
  const [preview, setPreview] = useState<PiPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    path: string;
    backupPath: string | null;
  } | null>(null);
  const valid = validConnection(input, agent);
  const change = (values: Partial<PiConnection>) => {
    setInput((prev) => ({ ...prev, ...values }));
    setPreview(null);
    setSuccess(null);
    setError("");
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("extraAgents.copied"));
    } catch (e) {
      setError(extractErrorMessage(e));
    }
  };
  const run = async (apply: boolean) => {
    setBusy(true);
    setError("");
    try {
      if (apply && preview) {
        setSuccess(await externalAgentsApi.applyPi(input, preview.fingerprint));
        setPreview(null);
      } else {
        setPreview(await externalAgentsApi.previewPi(input));
      }
    } catch (e) {
      setError(extractErrorMessage(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-w-2xl gap-0 overflow-hidden p-0"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-border/70 px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm text-primary">
              {info.mark}
            </span>
            {info.name}
          </DialogTitle>
          <DialogDescription>
            {t(`extraAgents.${info.mode}Description`)}
          </DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          aria-label={t("common.close")}
          disabled={busy}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="min-h-0 space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="extra-url">Base URL</Label>
              <Input
                id="extra-url"
                type="url"
                placeholder="https://your-relay.example/v1"
                disabled={busy}
                value={input.baseUrl}
                onChange={(e) => change({ baseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-model">{t("extraAgents.model")}</Label>
              <Input
                id="extra-model"
                placeholder="model-id"
                disabled={busy}
                value={input.model}
                onChange={(e) => change({ model: e.target.value })}
              />
            </div>
            {agent !== "workbuddy" && (
              <div className="space-y-2">
                <Label htmlFor="extra-protocol">
                  {t("extraAgents.protocol")}
                </Label>
                <SearchSelect
                  id="extra-protocol"
                  aria-label={t("extraAgents.protocol")}
                  disabled={busy}
                  value={input.api}
                  onValueChange={(api) =>
                    change({ api: api as PiConnection["api"] })
                  }
                  options={[
                    {
                      value: "openai-completions",
                      label: "OpenAI Chat Completions",
                    },
                    { value: "openai-responses", label: "OpenAI Responses" },
                    {
                      value: "anthropic-messages",
                      label: "Anthropic Messages",
                    },
                  ]}
                />
              </div>
            )}
            {agent === "pi" && (
              <div className="space-y-2">
                <Label htmlFor="extra-auth">{t("extraAgents.auth")}</Label>
                <SearchSelect
                  id="extra-auth"
                  aria-label={t("extraAgents.auth")}
                  disabled={busy}
                  value={input.credentialMode}
                  onValueChange={(mode) =>
                    change({
                      credentialMode: mode as "env" | "literal",
                      credential: mode === "env" ? "HROUTER_API_KEY" : "",
                    })
                  }
                  options={[
                    { value: "env", label: t("extraAgents.env") },
                    { value: "literal", label: t("extraAgents.literal") },
                  ]}
                />
              </div>
            )}
            {agent !== "workbuddy" && (
              <div className="space-y-2">
                <Label htmlFor="extra-credential">
                  {t(
                    input.credentialMode === "env"
                      ? "extraAgents.envName"
                      : "extraAgents.apiKey",
                  )}
                </Label>
                <Input
                  id="extra-credential"
                  type={
                    input.credentialMode === "literal" ? "password" : "text"
                  }
                  autoComplete="off"
                  disabled={busy}
                  value={input.credential}
                  onChange={(e) => change({ credential: e.target.value })}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {t(
                agent === "workbuddy"
                  ? "extraAgents.workbuddyNotice"
                  : input.credentialMode === "env"
                    ? "extraAgents.envNotice"
                    : "extraAgents.keyNotice",
              )}
            </span>
          </div>
          {agent === "deepseek-harness" && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("extraAgents.deepseekNotice")}
              </p>
              {valid && (
                <pre className="max-h-56 overflow-auto rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed">
                  {deepseekSnippet(input)}
                </pre>
              )}
            </div>
          )}
          {agent === "workbuddy" && (
            <ol className="list-inside list-decimal space-y-2 rounded-xl bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
              <li>{t("extraAgents.workbuddyStep1")}</li>
              <li>{t("extraAgents.workbuddyStep2")}</li>
              <li>{t("extraAgents.workbuddyStep3")}</li>
            </ol>
          )}
          {preview && (
            <div
              className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"
              role="status"
            >
              <p className="font-medium">{t("extraAgents.previewTitle")}</p>
              <code className="block break-all text-xs">{preview.path}</code>
              <p>
                {t(
                  preview.existed ? "extraAgents.backup" : "extraAgents.create",
                )}
              </p>
              <p>
                {t(
                  preview.updatingProvider
                    ? "extraAgents.updateProvider"
                    : "extraAgents.addProvider",
                  { count: preview.modelCount },
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("extraAgents.piNotice")}
              </p>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"
            >
              <p className="flex items-center gap-2 font-medium">
                <Check className="h-4 w-4" />
                {t("extraAgents.saved")}
              </p>
              <code className="block break-all text-xs">{success.path}</code>
              {success.backupPath && (
                <code className="block break-all text-xs">
                  {t("extraAgents.backupPath")}: {success.backupPath}
                </code>
              )}
              <p>{t("extraAgents.piNext")}</p>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2 border-t border-border/70 bg-muted/20 px-6 py-4 sm:justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={() =>
              void settingsApi
                .openExternal(info.url)
                .catch((e) => setError(extractErrorMessage(e)))
            }
          >
            <ExternalLink className="h-4 w-4" />
            {t("extraAgents.docs")}
          </Button>
          <div className="flex flex-wrap gap-2">
            {agent === "pi" ? (
              <Button
                disabled={!valid || busy || !!success}
                onClick={() => void run(!!preview)}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t(preview ? "extraAgents.apply" : "extraAgents.preview")}
              </Button>
            ) : agent === "deepseek-harness" ? (
              <Button
                disabled={!valid}
                onClick={() => void copy(deepseekSnippet(input))}
              >
                <Copy className="h-4 w-4" />
                {t("extraAgents.copySnippet")}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={!valid}
                  onClick={() => void copy(input.baseUrl.trim())}
                >
                  {t("extraAgents.copyUrl")}
                </Button>
                <Button
                  disabled={!valid}
                  onClick={() => void copy(input.model.trim())}
                >
                  {t("extraAgents.copyModel")}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
