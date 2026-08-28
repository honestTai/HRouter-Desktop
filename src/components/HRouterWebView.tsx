import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Home, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HROUTER_HOME_URL = "https://hrouter.net/home";

export function HRouterWebView() {
  const { t } = useTranslation();
  const [frameKey, setFrameKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const reload = () => {
    setIsLoading(true);
    setFrameKey((current) => current + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border-default bg-background px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={reload}
          title={t("hrouterWeb.home")}
          aria-label={t("hrouterWeb.home")}
        >
          <Home className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={reload}
          title={t("hrouterWeb.refresh")}
          aria-label={t("hrouterWeb.refresh")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-border-default bg-muted/30 px-3 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate font-mono">hrouter.net/home</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
            <span className="ml-2 text-sm text-muted-foreground">
              {t("hrouterWeb.loading")}
            </span>
          </div>
        )}
        <iframe
          key={frameKey}
          src={HROUTER_HOME_URL}
          title={t("hrouterWeb.title")}
          className="h-full w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; payment"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
