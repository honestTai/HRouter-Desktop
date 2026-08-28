import { useState } from "react";
import { Loader2, PanelsTopLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { embeddedTerminalApi } from "@/lib/api";
import { extractErrorMessage } from "@/utils/errorUtils";

export function WorkspaceLauncherButton() {
  const { t } = useTranslation();
  const [isOpening, setIsOpening] = useState(false);

  const handleOpen = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      await embeddedTerminalApi.openWorkspace();
    } catch (error) {
      const detail = extractErrorMessage(error);
      toast.error(
        t("terminalWorkspace.openFailed", {
          defaultValue: "工作台打开失败",
        }),
        detail ? { description: detail } : undefined,
      );
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleOpen()}
      disabled={isOpening}
      title={t("terminalWorkspace.openWorkspace", {
        defaultValue: "打开 HRouter 工作台",
      })}
      className="h-8 gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] px-2.5 text-xs font-medium text-emerald-700 shadow-sm hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
    >
      {isOpening ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <PanelsTopLeft className="h-4 w-4" />
      )}
      <span>{t("terminalWorkspace.entry", { defaultValue: "工作台" })}</span>
    </Button>
  );
}
