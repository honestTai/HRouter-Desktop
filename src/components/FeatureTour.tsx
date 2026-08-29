import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface FeatureTourProps {
  onNavigate: (view: string) => void;
}

interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const steps = [
  { target: "dashboard", view: "dashboard" },
  { target: "usage", view: "usage" },
  { target: "billing", view: "billing" },
  { target: "orders", view: "orders" },
  { target: "apiKeys", view: "apiKeys" },
  { target: "profile", view: "profile" },
  { target: "providers", view: "providers" },
] as const;

export function FeatureTour({ onNavigate }: FeatureTourProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);
  const step = steps[index];

  useEffect(() => {
    const start = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener("hrouter:start-tour", start);
    return () => window.removeEventListener("hrouter:start-tour", start);
  }, []);

  useEffect(() => {
    if (!open) return;
    onNavigate(step.view);
    let timer = 0;
    const update = () => {
      const element = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      if (!element) {
        setRect(null);
        return;
      }
      element.scrollIntoView({ block: "nearest" });
      const next = element.getBoundingClientRect();
      setRect({
        left: Math.max(6, next.left - 5),
        top: Math.max(6, next.top - 5),
        width: next.width + 10,
        height: next.height + 10,
      });
    };
    timer = window.setTimeout(update, 180);
    window.addEventListener("resize", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, [index, onNavigate, open, step.target, step.view]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const popoverStyle = useMemo(() => {
    if (!rect) return { left: 260, top: 96 };
    const width = 330;
    const preferredLeft = rect.left + rect.width + 16;
    const left =
      preferredLeft + width <= window.innerWidth - 16
        ? preferredLeft
        : Math.max(16, rect.left - width - 16);
    const top = Math.min(
      Math.max(16, rect.top),
      Math.max(16, window.innerHeight - 230),
    );
    return { left, top };
  }, [rect]);

  if (!open) return null;

  const finish = index === steps.length - 1;
  return (
    <div className="fixed inset-0 z-[190]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" />
      {rect && (
        <div
          className="pointer-events-none fixed z-[191] rounded-md border-2 border-cyan-400 bg-background/5 shadow-[0_0_0_4px_rgba(34,211,238,0.22)]"
          style={rect}
        />
      )}
      <div
        className="fixed z-[192] w-[330px] rounded-md border border-border-default bg-background p-4 shadow-2xl"
        style={popoverStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-cyan-600">
              {t("faq.tourProgress", {
                defaultValue: "{{current}} / {{total}}",
                current: index + 1,
                total: steps.length,
              })}
            </p>
            <h3 className="mt-1 text-sm font-semibold">
              {t(`faq.tour.${step.target}Title`)}
            </h3>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => setOpen(false)}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t(`faq.tour.${step.target}Description`)}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t("common.previous", { defaultValue: "上一步" })}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              finish ? setOpen(false) : setIndex((value) => value + 1)
            }
          >
            {finish
              ? t("common.finish", { defaultValue: "完成" })
              : t("common.next", { defaultValue: "下一步" })}
            {!finish && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
