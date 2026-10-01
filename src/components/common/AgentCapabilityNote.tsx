import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export function AgentCapabilityNote({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className="whitespace-nowrap text-[10px] font-normal text-muted-foreground"
    >
      {label ?? t("workspaceUi.notAdapted")}
    </Badge>
  );
}
