import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

export function validLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Text entry paired with our React calendars, not the OS date/time popup. */
export function TemporalInput({
  value,
  onValueChange,
  kind,
  ...props
}: Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "onBlur"
> & {
  value: string;
  onValueChange: (value: string) => void;
  kind: "date" | "time";
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = kind === "date" ? validLocalDate : validTime;
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={draft}
      placeholder={kind === "date" ? "YYYY-MM-DD" : "HH:mm"}
      onChange={(event) => {
        setDraft(event.target.value);
        if (valid(event.target.value)) onValueChange(event.target.value);
      }}
      onBlur={() => {
        if (!valid(draft)) setDraft(value);
      }}
    />
  );
}

export function DateTimeField({
  value,
  onValueChange,
  includeTime = false,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  includeTime?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const datePart = value.split("T")[0];
  const timePart = value.split("T")[1]?.slice(0, 5) || "00:00";
  const [month, setMonth] = useState(() => new Date());
  const choose = (date: string) => {
    onValueChange(includeTime ? `${date}T${timePart}` : date);
    if (!includeTime) setOpen(false);
  };
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next)
          setMonth(
            validLocalDate(datePart)
              ? new Date(`${datePart}T12:00:00`)
              : new Date(),
          );
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-10 w-full justify-start gap-2 font-normal",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>{value.replace("T", " ") || "YYYY-MM-DD"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-3" align="start">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.previous", { defaultValue: "上一月" })}
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {new Intl.DateTimeFormat(i18n.language || "en", {
              year: "numeric",
              month: "long",
            }).format(first)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.next", { defaultValue: "下一月" })}
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={`w${i}`}
              className="py-1 text-center text-[10px] text-muted-foreground"
            >
              {new Intl.DateTimeFormat(i18n.language || "en", {
                weekday: "short",
              }).format(new Date(2026, 0, 4 + i))}
            </span>
          ))}
          {Array.from({ length: first.getDay() }, (_, i) => (
            <span key={`empty${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = formatDate(
              new Date(month.getFullYear(), month.getMonth(), i + 1),
            );
            return (
              <Button
                key={date}
                type="button"
                size="sm"
                className="h-8 min-w-0 px-0"
                variant={datePart === date ? "default" : "ghost"}
                aria-label={date}
                aria-pressed={datePart === date}
                onClick={() => choose(date)}
              >
                {i + 1}
              </Button>
            );
          })}
        </div>
        <TemporalInput
          value={datePart}
          kind="date"
          onValueChange={choose}
          aria-label={t("workspaceUi.date")}
        />
        {includeTime && (
          <TemporalInput
            kind="time"
            value={timePart}
            aria-label={t("workspaceUi.time")}
            onValueChange={(time) => {
              if (validLocalDate(datePart))
                onValueChange(`${datePart}T${time}`);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
