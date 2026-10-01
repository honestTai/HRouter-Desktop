import { useEffect, useId, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";

export interface SelectChoice {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  keywords?: string[];
}
interface Props {
  options: SelectChoice[];
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
}
/** shadcn-style searchable combobox: Radix owns focus/dismissal, cmdk owns keyboard selection. */
export function SearchSelect({
  options,
  value,
  onValueChange,
  "aria-label": label,
  id,
  className,
  placeholder,
  disabled,
  allowCustomValue = false,
}: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setSearch("");
    }
  }, [disabled]);
  const selected = options.find((option) => option.value === value);
  const custom = search.trim();
  const choose = (next: string) => {
    if (disabled) return;
    onValueChange(next);
    setOpen(false);
    setSearch("");
  };
  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next);
        setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open && !disabled}
          aria-controls={listId}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "h-10 w-full min-w-0 justify-between rounded-xl border-border/80 bg-card px-3 text-left font-normal shadow-sm hover:border-primary/40 hover:bg-accent/40 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-primary/10",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate",
              !value && "text-muted-foreground",
            )}
            title={selected?.label || value || placeholder}
          >
            {selected?.label ||
              value ||
              placeholder ||
              t("uiSelect.placeholder")}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border-border/80 p-0 shadow-xl"
      >
        <Command loop shouldFilter={false} defaultValue={JSON.stringify(value)}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            aria-label={t("uiSelect.searchLabel", { label })}
            placeholder={t("uiSelect.search")}
            className="h-11"
          />
          <CommandList
            id={listId}
            aria-label={label}
            className="max-h-[min(18rem,var(--radix-popover-content-available-height))] p-1.5"
          >
            <CommandEmpty className="px-3 py-8 text-center text-xs text-muted-foreground">
              {t("uiSelect.empty")}
            </CommandEmpty>
            <CommandGroup className="p-0">
              {options
                .filter((option) =>
                  [option.label, option.value, ...(option.keywords ?? [])]
                    .join(" ")
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={JSON.stringify(option.value)}
                    disabled={option.disabled}
                    onSelect={() => choose(option.value)}
                    className="min-h-10 cursor-pointer rounded-lg px-3 py-2.5 data-[selected=true]:bg-primary/10"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                    <Check
                      aria-hidden
                      className={cn(
                        "h-4 w-4 text-primary",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              {allowCustomValue &&
                custom &&
                !options.some((option) => option.value === custom) && (
                  <CommandItem
                    value={`custom:${custom}`}
                    onSelect={() => choose(custom)}
                    className="min-h-10 cursor-pointer rounded-lg px-3"
                  >
                    <Plus className="h-4 w-4" />
                    {t("uiSelect.useValue", { value: custom })}
                  </CommandItem>
                )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
