import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpCircle,
  BarChart3,
  Bot,
  Check,
  CircleHelp,
  Copy,
  Gauge,
  Globe2,
  Headphones,
  Route,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { SUPPORT_QQ_GROUP } from "@/config/brand";
import { settingsApi } from "@/lib/api";
import { useSettingsQuery } from "@/lib/query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FEATURES = [
  {
    key: "portal",
    icon: Globe2,
    tone: "text-sky-600 bg-sky-500/10",
  },
  { key: "providers", icon: Route, tone: "text-blue-600 bg-blue-500/10" },
  { key: "modelPlaza", icon: Store, tone: "text-amber-600 bg-amber-500/10" },
  { key: "context", icon: Gauge, tone: "text-cyan-600 bg-cyan-500/10" },
  { key: "usage", icon: BarChart3, tone: "text-violet-600 bg-violet-500/10" },
  { key: "agents", icon: Bot, tone: "text-emerald-600 bg-emerald-500/10" },
  { key: "updates", icon: ArrowUpCircle, tone: "text-rose-600 bg-rose-500/10" },
] as const;

export function HelpCenterButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const [manualOpen, setManualOpen] = useState(false);
  const [acknowledgedLocally, setAcknowledgedLocally] = useState(false);

  const isFirstVisit =
    settings != null &&
    settings.firstRunNoticeConfirmed !== true &&
    !acknowledgedLocally;
  const isOpen = manualOpen || isFirstVisit;

  const acknowledgeFirstVisit = async () => {
    if (!settings || settings.firstRunNoticeConfirmed === true) return;

    setAcknowledgedLocally(true);
    try {
      const { webdavSync: _, ...rest } = settings;
      await settingsApi.save({ ...rest, firstRunNoticeConfirmed: true });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (error) {
      console.error("[HelpCenter] Failed to save first-run state", error);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setManualOpen(nextOpen);
    if (!nextOpen && isFirstVisit) {
      void acknowledgeFirstVisit();
    }
  };

  const copySupportGroup = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_QQ_GROUP);
      toast.success(t("faq.groupCopied"), { closeButton: true });
    } catch (error) {
      console.error("[HelpCenter] Failed to copy support group", error);
      toast.error(t("faq.groupCopyFailed"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setManualOpen(true)}
        title={t("faq.button")}
        aria-label={t("faq.button")}
        className="h-8 gap-1.5 rounded-md border-cyan-500/25 bg-cyan-500/5 px-2.5 text-xs text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"
      >
        <CircleHelp className="h-4 w-4" />
        <span className="hidden 2xl:inline">{t("faq.button")}</span>
      </Button>

      <DialogContent className="h-[min(780px,90vh)] max-w-5xl overflow-hidden">
        <DialogHeader className="relative pr-14">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <CircleHelp className="h-5 w-5" />
            </span>
            {t("faq.title")}
            {isFirstVisit && (
              <span className="rounded border border-cyan-500/25 bg-cyan-500/5 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
                {t("faq.firstVisitBadge")}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{t("faq.description")}</DialogDescription>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section aria-labelledby="faq-quick-start">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-600" />
              <h3 id="faq-quick-start" className="text-sm font-semibold">
                {t("faq.quickStart")}
              </h3>
            </div>
            <div className="grid grid-cols-3 border-y border-border-default bg-muted/15">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className="flex min-h-24 gap-3 border-r border-border-default px-4 py-4 last:border-r-0"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {step}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">
                      {t(`faq.step${step}Title`)}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(`faq.step${step}Description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6" aria-labelledby="faq-feature-overview">
            <h3
              id="faq-feature-overview"
              className="mb-2 text-sm font-semibold"
            >
              {t("faq.featureOverview")}
            </h3>
            <div className="grid grid-cols-2 border-t border-border-default">
              {FEATURES.map(({ key, icon: Icon, tone }, index) => (
                <div
                  key={key}
                  className={`flex min-h-28 gap-3 border-b border-border-default px-4 py-4 ${index % 2 === 0 ? "border-r" : ""} ${
                    index === FEATURES.length - 1 && FEATURES.length % 2 === 1
                      ? "col-span-2 border-r-0"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">
                      {t(`faq.${key}Title`)}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(`faq.${key}Description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 grid grid-cols-[1fr_auto] items-center gap-5 border border-orange-500/25 bg-orange-500/5 px-5 py-4">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Headphones className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">
                  {t("faq.supportTitle")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("faq.supportDescription", { group: SUPPORT_QQ_GROUP })}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copySupportGroup}
              className="gap-1.5 border-orange-500/30 bg-background text-orange-700 hover:bg-orange-500/10 dark:text-orange-300"
            >
              <Copy className="h-3.5 w-3.5" />
              {t("faq.copyGroup")}
            </Button>
          </section>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">{t("faq.footerHint")}</p>
          <DialogClose asChild>
            <Button type="button" className="gap-1.5">
              <Check className="h-4 w-4" />
              {t("faq.start")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
