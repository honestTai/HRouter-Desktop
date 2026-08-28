import { useEffect, useRef, useState } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Circle, Eraser, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import "@xterm/xterm/css/xterm.css";

import { Button } from "@/components/ui/button";
import { embeddedTerminalApi, type WorkspaceTool } from "@/lib/api";
import { extractErrorMessage } from "@/utils/errorUtils";

type ConnectionState = "connecting" | "connected" | "exited" | "error";

interface EmbeddedTerminalPaneProps {
  title: string;
  subtitle: string;
  tool: WorkspaceTool;
  cwd: string;
}

const decodeBase64 = (value: string) => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export function EmbeddedTerminalPane({
  title,
  subtitle,
  tool,
  cwd,
}: EmbeddedTerminalPaneProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const inputQueueRef = useRef<number[]>([]);
  const inputTimerRef = useRef<number | null>(null);
  const [generation, setGeneration] = useState(0);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new XTerminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily:
        '"Cascadia Code", "SFMono-Regular", "JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.25,
      letterSpacing: 0,
      scrollback: 10_000,
      theme: {
        background: "#111311",
        foreground: "#d9ded8",
        cursor: "#74c991",
        cursorAccent: "#111311",
        selectionBackground: "#355c45aa",
        black: "#171a18",
        red: "#e06c75",
        green: "#79c99e",
        yellow: "#d8b76c",
        blue: "#78a9d1",
        magenta: "#b69ad6",
        cyan: "#79c7c5",
        white: "#d9ded8",
        brightBlack: "#68716b",
        brightRed: "#f08a91",
        brightGreen: "#9bddb7",
        brightYellow: "#ead08a",
        brightBlue: "#9bc3e3",
        brightMagenta: "#ceb3e8",
        brightCyan: "#9ee0dd",
        brightWhite: "#f4f6f3",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    let disposed = false;
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    const encoder = new TextEncoder();
    const sessionId = crypto.randomUUID();
    sessionRef.current = sessionId;
    setConnectionState("connecting");

    const flushInput = () => {
      inputTimerRef.current = null;
      const queued = inputQueueRef.current.splice(0);
      if (queued.length === 0) return;
      void embeddedTerminalApi.write(sessionId, new Uint8Array(queued));
    };

    const dataDisposable = terminal.onData((data) => {
      inputQueueRef.current.push(...encoder.encode(data));
      if (inputTimerRef.current === null) {
        inputTimerRef.current = window.setTimeout(flushInput, 8);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (disposed || !host.isConnected) return;
        try {
          fitAddon.fit();
          void embeddedTerminalApi.resize(
            sessionId,
            terminal.cols,
            terminal.rows,
          );
        } catch {
          // The pane can briefly have zero dimensions while the layout changes.
        }
      });
    });
    resizeObserver.observe(host);

    const start = async () => {
      try {
        unlistenOutput = await embeddedTerminalApi.onOutput((payload) => {
          if (payload.sessionId === sessionId) {
            terminal.write(decodeBase64(payload.data));
          }
        });
        unlistenExit = await embeddedTerminalApi.onExit((payload) => {
          if (payload.sessionId === sessionId) {
            setConnectionState("exited");
          }
        });
        fitAddon.fit();
        await embeddedTerminalApi.start({
          sessionId,
          tool,
          cwd,
          cols: terminal.cols,
          rows: terminal.rows,
        });
        if (!disposed) {
          setConnectionState("connected");
          terminal.focus();
        }
      } catch (error) {
        if (disposed) return;
        setConnectionState("error");
        const detail = extractErrorMessage(error);
        terminal.writeln(
          `\r\n\x1b[31m${detail || "Terminal failed to start"}\x1b[0m`,
        );
        toast.error(
          t("terminalWorkspace.startFailed", {
            defaultValue: "终端启动失败",
          }),
          detail ? { description: detail } : undefined,
        );
      }
    };

    void start();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      if (inputTimerRef.current !== null) {
        window.clearTimeout(inputTimerRef.current);
        inputTimerRef.current = null;
      }
      inputQueueRef.current = [];
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      sessionRef.current = null;
      void embeddedTerminalApi.stop(sessionId);
    };
  }, [cwd, generation, t, tool]);

  const stateLabel = t(`terminalWorkspace.state.${connectionState}`, {
    defaultValue: connectionState,
  });

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#111311]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/10 bg-[#171a18] px-3 text-white">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{title}</div>
          <div className="truncate text-[10px] text-white/45">{subtitle}</div>
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] text-white/55"
          title={stateLabel}
        >
          <Circle
            className={`h-2 w-2 fill-current ${
              connectionState === "connected"
                ? "text-emerald-400"
                : connectionState === "connecting"
                  ? "animate-pulse text-amber-300"
                  : "text-rose-400"
            }`}
          />
          <span>{stateLabel}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/55 hover:bg-white/10 hover:text-white"
          onClick={() => terminalRef.current?.clear()}
          title={t("terminalWorkspace.clear", { defaultValue: "清屏" })}
        >
          <Eraser className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/55 hover:bg-white/10 hover:text-white"
          onClick={() => setGeneration((value) => value + 1)}
          title={t("terminalWorkspace.restart", { defaultValue: "重启" })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </header>
      <div
        ref={hostRef}
        className="terminal-host min-h-0 flex-1 px-2 py-2"
        onClick={() => terminalRef.current?.focus()}
      />
    </section>
  );
}
