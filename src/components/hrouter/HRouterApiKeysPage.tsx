import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  hrouterAccountApi,
  type HRouterApiKey,
} from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

function maskedKey(value: string) {
  if (value.length < 14) return value;
  return `${value.slice(0, 8)}••••••••${value.slice(-4)}`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    await invoke("copy_text_to_clipboard", { text: value });
  }
}

export function HRouterApiKeysPage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<HRouterApiKey | null>(null);
  const [keyName, setKeyName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<HRouterApiKey | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const keys = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "keys"],
    queryFn: () => hrouterAccountApi.keys(),
    enabled: Boolean(session),
  });
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["hrouter-account", session?.user.id, "keys"],
    });

  const createKey = useMutation({
    mutationFn: () => hrouterAccountApi.createKey(keyName.trim()),
    onSuccess: (key) => {
      setCreateOpen(false);
      setKeyName("");
      setCreatedKey(key);
      void invalidate();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const updateKey = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: "active" | "inactive";
    }) => hrouterAccountApi.updateKey(id, { status }),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const deleteKey = useMutation({
    mutationFn: (id: number) => hrouterAccountApi.deleteKey(id),
    onSuccess: () => {
      setDeleteTarget(null);
      void invalidate();
      toast.success(t("hrouterPlatform.keyDeleted"));
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const handleCopy = async (key: HRouterApiKey) => {
    await copyText(key.key);
    setCopiedId(key.id);
    window.setTimeout(
      () => setCopiedId((id) => (id === key.id ? null : id)),
      1500,
    );
  };

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={() => void keys.refetch()}
        refreshing={keys.isFetching}
      >
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("hrouterPlatform.createKey")}
          </Button>
        </div>
        {keys.isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("hrouterPlatform.loadingKeys")}
          </div>
        ) : keys.error ? (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {extractErrorMessage(keys.error)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border-default bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-10">
                    {t("hrouterPlatform.name")}
                  </TableHead>
                  <TableHead className="h-10">
                    {t("hrouterPlatform.key")}
                  </TableHead>
                  <TableHead className="h-10">
                    {t("hrouterPlatform.status")}
                  </TableHead>
                  <TableHead className="h-10 text-right">
                    {t("hrouterPlatform.usedQuota")}
                  </TableHead>
                  <TableHead className="h-10 text-right">
                    {t("hrouterPlatform.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(keys.data?.items ?? []).map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="py-3 font-medium">
                      {key.name}
                    </TableCell>
                    <TableCell className="py-3">
                      <code className="text-xs text-muted-foreground">
                        {maskedKey(key.key)}
                      </code>
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={`inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${key.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                      >
                        {key.status === "active"
                          ? t("hrouterPlatform.active")
                          : t("hrouterPlatform.inactive")}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums">
                      ¥{Number(key.quota_used || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={t("hrouterPlatform.copyKey")}
                          onClick={() => void handleCopy(key)}
                        >
                          {copiedId === key.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={
                            key.status === "active"
                              ? t("hrouterPlatform.disable")
                              : t("hrouterPlatform.enable")
                          }
                          onClick={() =>
                            updateKey.mutate({
                              id: key.id,
                              status:
                                key.status === "active" ? "inactive" : "active",
                            })
                          }
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-red-500"
                          title={t("common.delete")}
                          onClick={() => setDeleteTarget(key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(keys.data?.items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-40 text-center text-muted-foreground"
                    >
                      {t("hrouterPlatform.noKeys")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("hrouterPlatform.createKeyTitle")}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5">
              <Label htmlFor="hrouter-key-name">
                {t("hrouterPlatform.keyName")}
              </Label>
              <Input
                id="hrouter-key-name"
                className="mt-2"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder={t("hrouterPlatform.keyNamePlaceholder")}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!keyName.trim() || createKey.isPending}
                onClick={() => createKey.mutate()}
              >
                {createKey.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("hrouterPlatform.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(createdKey)}
          onOpenChange={(open) => !open && setCreatedKey(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("hrouterPlatform.keyCreated")}</DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.saveCreatedKey")}
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5">
              <code className="block break-all rounded-md border border-border-default bg-muted/40 p-3 text-xs">
                {createdKey?.key}
              </code>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatedKey(null)}>
                {t("common.close")}
              </Button>
              <Button onClick={() => createdKey && void handleCopy(createdKey)}>
                <Copy className="h-4 w-4" />
                {t("hrouterPlatform.copyKey")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("hrouterPlatform.deleteKey")}</DialogTitle>
              <DialogDescription>
                {t("hrouterPlatform.deleteKeyConfirm", {
                  name: deleteTarget?.name,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteKey.isPending}
                onClick={() =>
                  deleteTarget && deleteKey.mutate(deleteTarget.id)
                }
              >
                {t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
