import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useUpdate } from "@/contexts/UpdateContext";
import { settingsApi } from "@/lib/api";
import { getCurrentVersion } from "@/lib/updater";
import { extractErrorMessage } from "@/utils/errorUtils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpdateBadgeProps {
  className?: string;
}

const UPDATE_NOTICE_STORAGE_PREFIX = "hrouter-update-notice:";

export function UpdateBadge({ className = "" }: UpdateBadgeProps) {
  const {
    hasUpdate,
    updateInfo,
    isChecking,
    hasChecked,
    error,
    checkUpdate,
    resetDismiss,
  } = useUpdate();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("");
  const [isPortable, setIsPortable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const isActive = hasUpdate && Boolean(updateInfo);
  const title = isActive
    ? t("settings.updateAvailable", {
        version: updateInfo?.availableVersion ?? "",
      })
    : t("settings.versionUpdate");

  useEffect(() => {
    if (!open) return;

    void getCurrentVersion().then(setCurrentVersion);
    void settingsApi
      .isPortable()
      .then(setIsPortable)
      .catch(() => setIsPortable(false));

    if (!hasChecked && !isChecking) {
      void checkUpdate().catch(() => undefined);
    }
  }, [checkUpdate, hasChecked, isChecking, open]);

  useEffect(() => {
    const version = updateInfo?.availableVersion;
    if (!hasUpdate || !version) return;

    const noticeKey = `${UPDATE_NOTICE_STORAGE_PREFIX}${version}`;
    try {
      if (localStorage.getItem(noticeKey) === "shown") return;
      localStorage.setItem(noticeKey, "shown");
    } catch (storageError) {
      console.warn(
        "[UpdateBadge] Failed to persist update notice",
        storageError,
      );
    }
    setOpen(true);
  }, [hasUpdate, updateInfo?.availableVersion]);

  const publishedAt = useMemo(() => {
    if (!updateInfo?.pubDate) return "";
    const date = new Date(updateInfo.pubDate);
    if (Number.isNaN(date.getTime())) return updateInfo.pubDate;
    return date.toLocaleDateString(i18n.language);
  }, [i18n.language, updateInfo?.pubDate]);

  const handleCheck = async () => {
    try {
      const available = await checkUpdate();
      if (!available) {
        toast.success(t("settings.upToDate"), { closeButton: true });
      }
    } catch (checkError) {
      console.error("[UpdateBadge] Check update failed", checkError);
      toast.error(t("settings.checkUpdateFailed"));
    }
  };

  const handleInstall = async () => {
    if (isPortable) {
      try {
        await settingsApi.checkUpdates();
      } catch (installError) {
        console.error("[UpdateBadge] Portable update failed", installError);
        toast.error(t("settings.updateFailed"));
      }
      return;
    }

    setIsInstalling(true);
    try {
      resetDismiss();
      const installed = await settingsApi.installUpdateAndRestart();
      if (!installed) {
        toast.success(t("settings.upToDate"), { closeButton: true });
      }
    } catch (installError) {
      console.error("[UpdateBadge] Update failed", installError);
      toast.error(t("settings.updateFailed"), {
        description: extractErrorMessage(installError) || undefined,
        closeButton: true,
      });
      try {
        await settingsApi.checkUpdates();
      } catch (fallbackError) {
        console.error("[UpdateBadge] Fallback updater failed", fallbackError);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const displayedCurrentVersion =
    updateInfo?.currentVersion || currentVersion || t("common.unknown");
  const displayedLatestVersion =
    updateInfo?.availableVersion || displayedCurrentVersion;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={title}
        aria-label={title}
        onClick={() => setOpen(true)}
        className={cn(
          "relative h-8 gap-1.5 rounded-md px-2.5 text-xs",
          isActive
            ? "border-blue-500/30 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-300"
            : "border-border-default bg-background/70 text-foreground hover:bg-muted/60",
          className,
        )}
      >
        <ArrowUpCircle className="h-4 w-4" />
        <span>{t("settings.versionUpdate")}</span>
        {isActive && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-500" />
        )}
      </Button>

      <DialogContent className="max-w-xl overflow-hidden">
        <DialogHeader className="relative pr-14">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ArrowUpCircle className="h-5 w-5" />
            </span>
            {t("settings.versionUpdate")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.versionUpdateHint")}
          </DialogDescription>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-8 w-8"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-4 rounded-md border border-border-default bg-muted/20 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">
                {t("settings.currentVersion")}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                v{displayedCurrentVersion.replace(/^v/, "")}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 text-right">
              <div className="text-xs text-muted-foreground">
                {t("settings.latestVersion")}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {isChecking ? (
                  <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  `v${displayedLatestVersion.replace(/^v/, "")}`
                )}
              </div>
            </div>
          </div>

          {isChecking ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              {t("settings.checking")}
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3">
              <div className="text-sm font-medium text-red-600 dark:text-red-400">
                {t("settings.checkUpdateFailed")}
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {error}
              </p>
            </div>
          ) : isActive && updateInfo ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {t("settings.releaseNotes")}
                </h3>
                {publishedAt && (
                  <span className="text-xs text-muted-foreground">
                    {t("settings.releaseDate", { date: publishedAt })}
                  </span>
                )}
              </div>
              <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border-default bg-muted/15 px-4 py-3 text-sm leading-6 text-foreground">
                {updateInfo.notes?.trim() || t("settings.noReleaseNotes")}
              </div>
              {isPortable && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("settings.portableMode")}
                </p>
              )}
            </div>
          ) : hasChecked ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              <div className="text-sm font-medium">
                {t("settings.upToDate")}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.upToDateHint")}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("common.close")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={isActive ? "outline" : "default"}
            onClick={handleCheck}
            disabled={isChecking || isInstalling}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`}
            />
            {t("settings.checkForUpdates")}
          </Button>
          {isActive && updateInfo && (
            <Button
              type="button"
              onClick={handleInstall}
              disabled={isChecking || isInstalling}
              className="gap-1.5"
            >
              {isInstalling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isInstalling
                ? t("settings.updating")
                : t("settings.updateTo", {
                    version: updateInfo.availableVersion,
                  })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
