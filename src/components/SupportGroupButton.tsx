import { Copy, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SUPPORT_QQ_GROUP } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SupportGroupButtonProps {
  className?: string;
  sidebar?: boolean;
}

export function SupportGroupButton({
  className = "",
  sidebar = false,
}: SupportGroupButtonProps) {
  const { t } = useTranslation();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_QQ_GROUP);
      toast.success(t("settings.supportGroupCopied"), { closeButton: true });
    } catch (error) {
      console.error("[SupportGroupButton] Failed to copy group number", error);
      toast.error(t("settings.supportGroupCopyFailed"));
    }
  };

  const supportHint = t("settings.afterSalesSupportHint", {
    group: SUPPORT_QQ_GROUP,
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      title={supportHint}
      aria-label={supportHint}
      className={cn(
        sidebar
          ? "h-10 w-full justify-start gap-3 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
          : "h-8 gap-1.5 rounded-md border-orange-500/35 bg-orange-500/10 px-2.5 text-xs font-medium text-orange-700 shadow-sm hover:border-orange-500/50 hover:bg-orange-500/15 dark:text-orange-300",
        className,
      )}
    >
      <Headphones className="h-4 w-4" />
      <span>{t("settings.supportGroupLabel")}</span>
      {sidebar ? (
        <>
          <span className="ml-auto font-mono text-xs">{SUPPORT_QQ_GROUP}</span>
          <Copy className="h-3.5 w-3.5 opacity-60" />
        </>
      ) : (
        <>
          <span>：</span>
          <span className="font-mono font-semibold">{SUPPORT_QQ_GROUP}</span>
          <Copy className="h-3.5 w-3.5 opacity-70" />
        </>
      )}
    </Button>
  );
}
