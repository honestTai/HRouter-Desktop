import { FolderOpen, Terminal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Button } from "@/components/ui/button";
import { APP_ICON_MAP } from "@/config/appConfig";
import type { AppId } from "@/lib/api";
import { EmbeddedTerminalPane } from "./EmbeddedTerminalPane";

export interface TerminalWorkspaceTarget {
  providerId: string;
  providerName: string;
  appId: AppId;
  cwd: string;
}

export function TerminalWorkspace({
  target,
}: {
  target: TerminalWorkspaceTarget;
}) {
  const { t } = useTranslation();
  const appConfig = APP_ICON_MAP[target.appId];

  return (
    <main className="flex h-screen min-h-0 bg-[#111311] text-white">
      <div className="min-w-0 flex-1">
        <EmbeddedTerminalPane
          title={`${appConfig.label} CLI`}
          subtitle={target.cwd}
          providerId={target.providerId}
          appId={target.appId}
          cwd={target.cwd}
        />
      </div>

      <aside className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-[#191c1a]">
        <header className="flex h-11 items-center justify-between border-b border-white/10 px-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            {t("terminalWorkspace.title", { defaultValue: "CLI 工作台" })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/50 hover:bg-white/10 hover:text-white"
            onClick={() => void getCurrentWindow().close()}
            title={t("common.close", { defaultValue: "关闭" })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </header>

        <div className="flex flex-1 flex-col px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5">
              {appConfig.icon}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {appConfig.label}
              </div>
              <div className="text-[10px] uppercase text-emerald-400/80">
                Agent CLI
              </div>
            </div>
          </div>

          <dl className="mt-7 space-y-5 text-xs">
            <div>
              <dt className="mb-1 text-[10px] uppercase text-white/35">
                {t("terminalWorkspace.provider", {
                  defaultValue: "供应商",
                })}
              </dt>
              <dd className="truncate text-white/80">{target.providerName}</dd>
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-1.5 text-[10px] uppercase text-white/35">
                <FolderOpen className="h-3 w-3" />
                {t("terminalWorkspace.workingDirectory", {
                  defaultValue: "工作目录",
                })}
              </dt>
              <dd className="break-all leading-5 text-white/65">
                {target.cwd}
              </dd>
            </div>
          </dl>

          <p className="mt-auto border-t border-white/10 pt-4 text-[10px] leading-4 text-white/35">
            {t("terminalWorkspace.nativePty", {
              defaultValue:
                "使用操作系统原生 PTY，关闭窗口会结束当前 CLI 进程。",
            })}
          </p>
        </div>
      </aside>
    </main>
  );
}
