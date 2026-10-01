import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppId } from "@/lib/api";
import { APP_IDS, APP_ICON_MAP } from "@/config/appConfig";
import { Button } from "@/components/ui/button";
import { AgentCapabilityNote } from "./AgentCapabilityNote";

/** Display inventory is always complete; only implemented adapters can be selected. */
export function AgentPicker({
  value,
  supported,
  onChange,
  disabled = false,
}: {
  value: AppId;
  supported: readonly AppId[];
  onChange: (app: AppId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {APP_IDS.map((app) => (
        <Button
          key={app}
          type="button"
          variant="outline"
          aria-label={APP_ICON_MAP[app].label}
          disabled={disabled || !supported.includes(app)}
          aria-pressed={app === value}
          onClick={() => onChange(app)}
          className={cn(
            "relative h-auto min-h-14 min-w-0 flex-wrap justify-start gap-2 px-3 py-2 text-xs whitespace-normal",
            app === value &&
              "border-primary bg-primary/10 text-primary ring-1 ring-primary hover:bg-primary/15",
          )}
        >
          {APP_ICON_MAP[app].icon}
          <span className="min-w-0 truncate">{APP_ICON_MAP[app].label}</span>
          {app === value && (
            <CheckCircle2
              aria-hidden="true"
              className="ml-auto h-4 w-4 shrink-0"
            />
          )}
          {!supported.includes(app) && <AgentCapabilityNote />}
        </Button>
      ))}
    </div>
  );
}
