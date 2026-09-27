import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { accessApi } from "@/lib/api/access";
import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/utils/errorUtils";

export function UsageRepair() {
  const { t } = useTranslation();

  const client = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h3 className="font-semibold">
        {t("accessWorkbench.repairDuplicatedOpencodeHistory", {
          defaultValue: "修复 OpenCode 历史重复统计",
        })}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t("accessWorkbench.backUpTheLocalDatabaseThenClearOpencodeSession", {
          defaultValue:
            "先备份本机数据库，再清理 OpenCode 会话来源的明细、汇总和同步游标，从现存原始日志重新导入。代理请求记录保留；已从 OpenCode 删除的原始历史无法重建。",
        })}
      </p>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t(
          "accessWorkbench.iUnderstandSessionStatisticsWillBeRebuiltFromExisting",
          { defaultValue: "我了解将以现存 OpenCode 原始记录重建会话统计" },
        )}
      </label>
      <Button
        disabled={!confirmed || busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setMessage("");
            try {
              const result = await accessApi.rebuildOpenCode();
              setMessage(
                t("accessWorkbench.rebuildResult", {
                  defaultValue:
                    "已重建，导入 {{value0}} 条；{{value1}} 项异常。",
                  value0: result.imported,
                  value1: result.errors.length,
                }),
              );
              setConfirmed(false);
              await client.invalidateQueries({ queryKey: ["usage"] });
            } catch (e) {
              setMessage(extractErrorMessage(e));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {t("accessWorkbench.backUpAndRebuildOpencodeUsage", {
          defaultValue: "备份并重建 OpenCode 用量",
        })}
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
