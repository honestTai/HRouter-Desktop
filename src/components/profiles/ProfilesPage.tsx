import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import { providersApi } from "@/lib/api";
import type { Profile, ProfileScope } from "@/lib/api/profiles";
import {
  useApplyProfileMutation,
  useClearProfileMutation,
  useCreateProfileMutation,
  useDeleteProfileMutation,
  useProfilesQuery,
  useUpdateProfileMutation,
} from "@/lib/query/profiles";
import { APP_PROFILE_SCOPE, hasScopeSnapshot } from "./scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/utils/errorUtils";

type Action = {
  kind: "apply" | "snapshot" | "delete" | "clear";
  profile: Profile;
  scope: ProfileScope;
};
const SCOPES: ProfileScope[] = ["claude", "claude-desktop", "codex"];
const LABELS = {
  claude: "Claude Code",
  "claude-desktop": "Claude Desktop",
  codex: "Codex",
};

export function ProfilesPage({ activeApp }: { activeApp: AppId }) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<ProfileScope>(
    APP_PROFILE_SCOPE[activeApp] ?? "claude",
  );
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [failure, setFailure] = useState("");
  const list = useProfilesQuery();
  // Do not swallow errors or reuse another Agent's data in the change preview.
  const live = useQuery({
    queryKey: ["profile-preview", scope],
    queryFn: async () => ({
      providers: await providersApi.getAll(scope),
      current: await providersApi.getCurrent(scope),
    }),
  });
  const create = useCreateProfileMutation();
  const apply = useApplyProfileMutation();
  const update = useUpdateProfileMutation();
  const remove = useDeleteProfileMutation();
  const clear = useClearProfileMutation();
  const busy =
    create.isPending ||
    apply.isPending ||
    update.isPending ||
    remove.isPending ||
    clear.isPending;
  const disabled = busy || list.isPending || list.isError;
  const profiles = list.data?.profiles ?? [];
  const currentId =
    list.data?.currentIds?.[
      scope === "claude-desktop" ? "claudeDesktop" : scope
    ];
  const label = (id: string | null | undefined) =>
    id ? (live.data?.providers[id]?.name ?? id) : t("accessPlans.unchanged");
  const report = (error: unknown) =>
    setFailure(extractErrorMessage(error) || t("accessPlans.failed"));
  const save = () => {
    if (disabled || !name.trim()) return;
    setFailure("");
    create.mutate(
      { name: name.trim(), scope },
      { onSuccess: () => setName(""), onError: report },
    );
  };
  const confirm = () => {
    if (!action || busy) return;
    const { profile, scope: targetScope, kind } = action;
    const options = { onSuccess: () => setAction(null), onError: report };
    setFailure("");
    if (kind === "delete") remove.mutate(profile.id, options);
    if (kind === "clear") clear.mutate(targetScope, options);
    if (kind === "snapshot")
      update.mutate(
        { id: profile.id, resnapshot: true, scope: targetScope },
        options,
      );
    if (kind === "apply")
      apply.mutate(
        { id: profile.id, scope: targetScope },
        {
          ...options,
          onSuccess: (result) => {
            setWarnings(result);
            setAction(null);
            void live.refetch();
          },
        },
      );
  };
  const preview = action
    ? [
        t(`accessPlans.${action.kind}Warning`, {
          name: action.profile.name,
          app: LABELS[action.scope],
        }),
        ...(action.kind === "apply"
          ? [
              `${t("accessPlans.provider")}: ${label(live.data?.current)} → ${label(action.profile.payload.providers[action.scope])}`,
              `MCP: ${action.profile.payload.mcp[action.scope]?.join(", ") || (action.profile.payload.mcp[action.scope] === null ? t("accessPlans.unchanged") : t("accessPlans.empty"))}`,
              `Skills: ${action.profile.payload.skills[action.scope]?.join(", ") || (action.profile.payload.skills[action.scope] === null ? t("accessPlans.unchanged") : t("accessPlans.empty"))}`,
              `${t("accessPlans.prompt")}: ${action.profile.payload.prompts[action.scope] || t("accessPlans.unchanged")}`,
            ]
          : []),
      ].join("\n")
    : "";

  return (
    <div className="h-full overflow-y-auto px-6 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="workspace-eyebrow">HROUTER / PROFILES</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {t("workspace.profilesTitle")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("accessPlans.description")}
          </p>
        </header>
        {!APP_PROFILE_SCOPE[activeApp] && (
          <p className="text-sm text-muted-foreground">
            {t("accessPlans.supported")}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {SCOPES.map((id) => (
            <button
              key={id}
              type="button"
              disabled={busy || !!action}
              aria-pressed={scope === id}
              onClick={() => {
                setScope(id);
                setFailure("");
                setWarnings([]);
              }}
              className={cn(
                "rounded-lg border p-4 text-left text-sm font-medium disabled:opacity-50",
                scope === id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              {LABELS[id]}
            </button>
          ))}
        </div>
        {list.isError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive p-4"
          >
            <p>
              {t("accessPlans.loadFailed")}: {extractErrorMessage(list.error)}
            </p>
            <Button variant="outline" onClick={() => void list.refetch()}>
              {t("accessPlans.retry")}
            </Button>
          </div>
        )}
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {warnings.length > 0 && (
          <div role="alert" className="rounded-lg border border-amber-500 p-4">
            <h2 className="font-medium">{t("accessPlans.partial")}</h2>
            <ul className="mt-2 list-inside list-disc text-sm">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">{t("accessPlans.createTitle")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("accessPlans.snapshotHint")}
            </p>
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Input
              aria-label={t("accessPlans.name")}
              placeholder={t("accessPlans.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
              maxLength={100}
              className="w-56"
            />
            <Button disabled={disabled || !name.trim()} type="submit">
              {t("accessPlans.create")}
            </Button>
          </form>
        </section>
        <Input
          aria-label={t("accessPlans.search")}
          placeholder={t("accessPlans.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {list.isPending && <p role="status">{t("accessPlans.loading")}</p>}
        {!list.isPending &&
          !list.isError &&
          profiles.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase()),
          ).length === 0 && (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              {t("accessPlans.noResults")}
            </p>
          )}
        <div className="grid gap-4 md:grid-cols-2">
          {profiles
            .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
            .map((profile) => (
              <article
                key={profile.id}
                className={cn(
                  "space-y-4 rounded-lg border bg-card p-5",
                  currentId === profile.id
                    ? "border-primary/50"
                    : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="break-all font-semibold">{profile.name}</h2>
                  {currentId === profile.id && (
                    <span className="text-xs text-primary">
                      {t("accessPlans.currentMarker")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {hasScopeSnapshot(profile, scope)
                    ? `${t("accessPlans.provider")}: ${label(profile.payload.providers[scope])}`
                    : t("accessPlans.noSnapshot")}
                </p>
                <p className="text-xs text-muted-foreground">
                  MCP: {profile.payload.mcp[scope]?.length ?? "—"} · Skills:{" "}
                  {profile.payload.skills[scope]?.length ?? "—"}
                </p>
                {renaming === profile.id && (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!rename.trim() || busy) return;
                      update.mutate(
                        { id: profile.id, name: rename.trim() },
                        { onSuccess: () => setRenaming(null), onError: report },
                      );
                    }}
                  >
                    <Input
                      aria-label={t("accessPlans.rename")}
                      value={rename}
                      onChange={(e) => setRename(e.target.value)}
                      disabled={busy}
                    />
                    <Button disabled={busy || !rename.trim()}>
                      {t("accessPlans.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRenaming(null)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </form>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={
                      disabled ||
                      !hasScopeSnapshot(profile, scope) ||
                      !live.data ||
                      live.isFetching ||
                      live.isError
                    }
                    onClick={() => {
                      setWarnings([]);
                      setAction({ kind: "apply", profile, scope });
                    }}
                  >
                    {t("accessPlans.apply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      setAction({ kind: "snapshot", profile, scope })
                    }
                  >
                    {t("accessPlans.snapshot")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => {
                      setRenaming(profile.id);
                      setRename(profile.name);
                    }}
                  >
                    {t("accessPlans.rename")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      setAction({ kind: "delete", profile, scope })
                    }
                  >
                    {t("accessPlans.delete")}
                  </Button>
                  {currentId === profile.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() =>
                        setAction({ kind: "clear", profile, scope })
                      }
                    >
                      {t("accessPlans.clear")}
                    </Button>
                  )}
                </div>
              </article>
            ))}
        </div>
        {live.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("accessPlans.previewFailed")}{" "}
            <Button variant="ghost" onClick={() => void live.refetch()}>
              {t("accessPlans.retry")}
            </Button>
          </p>
        )}
        {action && (
          <ConfirmDialog
            isOpen
            title={t(`accessPlans.${action.kind}`)}
            message={preview}
            pending={busy}
            error={failure}
            variant={action.kind === "delete" ? "destructive" : "info"}
            confirmText={t("common.confirm")}
            onConfirm={confirm}
            onCancel={() => {
              if (!busy) setAction(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
