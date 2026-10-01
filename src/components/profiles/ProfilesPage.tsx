import { useMemo, useState } from "react";
import { Check, FolderOpen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import type { ProfileScope } from "@/lib/api/profiles";
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
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const SCOPES: Array<{ id: ProfileScope; label: string; description: string }> =
  [
    {
      id: "claude",
      label: "Claude Code",
      description: "供应商、MCP、Skills 和提示词",
    },
    {
      id: "claude-desktop",
      label: "Claude Desktop",
      description: "桌面端独立接入方案",
    },
    { id: "codex", label: "Codex", description: "Codex 供应商和历史配置" },
  ];

export function ProfilesPage({ activeApp }: { activeApp: AppId }) {
  const { t } = useTranslation();
  const initialScope = APP_PROFILE_SCOPE[activeApp] ?? "claude";
  const [scope, setScope] = useState<ProfileScope>(initialScope);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { data, isLoading } = useProfilesQuery();
  const createMutation = useCreateProfileMutation();
  const applyMutation = useApplyProfileMutation();
  const updateMutation = useUpdateProfileMutation();
  const deleteMutation = useDeleteProfileMutation();
  const clearMutation = useClearProfileMutation();
  const currentId = useMemo(() => {
    if (!data) return null;
    return scope === "claude-desktop"
      ? data.currentIds.claudeDesktop
      : data.currentIds[scope];
  }, [data, scope]);
  const profiles = data?.profiles ?? [];

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate({ name, scope }, { onSuccess: () => setNewName("") });
  };

  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <div>
          <p className="workspace-eyebrow">HROUTER WORKSPACES</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("workspace.profilesTitle", { defaultValue: "接入方案" })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                保存一整套 Agent 接入配置，切换方案时不会改变历史会话。
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <FolderOpen className="h-4 w-4" /> {profiles.length} 个方案
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                scope === item.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {item.label}
                {scope === item.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">创建当前配置方案</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                会保存当前 Agent 的供应商配置，不会上传 API Key。
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && create()}
                placeholder="例如：日常开发"
                className="h-9 sm:w-56"
              />
              <Button
                size="sm"
                onClick={create}
                disabled={!newName.trim() || createMutation.isPending}
              >
                <Plus className="h-4 w-4" /> 创建方案
              </Button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            正在读取方案…
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            还没有接入方案，先在上方保存一套当前配置。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {profiles.map((profile) => {
              const captured = hasScopeSnapshot(profile, scope);
              const active = profile.id === currentId;
              return (
                <article
                  key={profile.id}
                  className={cn(
                    "rounded-lg border bg-card p-5 transition-colors",
                    active
                      ? "border-primary/50 bg-primary/[0.03]"
                      : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium">{profile.name}</h3>
                        {active && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            当前使用
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {captured
                          ? "已保存当前 Agent 的完整接入状态"
                          : "这个方案还没有保存当前 Agent 的配置"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="删除方案"
                      onClick={() => deleteMutation.mutate(profile.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        applyMutation.mutate({ id: profile.id, scope })
                      }
                      disabled={!captured || active || applyMutation.isPending}
                    >
                      {active ? <Check className="h-3.5 w-3.5" /> : null}
                      {active ? "已应用" : "应用方案"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: profile.id,
                          resnapshot: true,
                          scope,
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> 更新当前配置
                    </Button>
                    {active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearMutation.mutate(scope)}
                        disabled={clearMutation.isPending}
                      >
                        取消当前方案
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {deleteTarget && (
        <ConfirmDialog
          isOpen
          title="删除接入方案？"
          message={`将删除“${deleteTarget.name}”，不会删除供应商或历史会话。`}
          confirmText="删除"
          variant="destructive"
          onConfirm={() => {
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
