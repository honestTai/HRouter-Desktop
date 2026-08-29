import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  HRouterApiKey,
  HRouterGroup,
  HRouterKeyCreateInput,
  HRouterKeyUpdateInput,
} from "@/lib/api/hrouterPlatform";

interface HRouterKeyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: HRouterGroup[];
  apiKey?: HRouterApiKey | null;
  pending?: boolean;
  onSubmit: (values: HRouterKeyCreateInput | HRouterKeyUpdateInput) => void;
}

type ExpirationPreset = "7" | "30" | "90" | "custom";

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function ToggleField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border-default px-3 py-2.5">
      <div>
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function HRouterKeyFormDialog({
  open,
  onOpenChange,
  groups,
  apiKey,
  pending = false,
  onSubmit,
}: HRouterKeyFormDialogProps) {
  const { t } = useTranslation();
  const editing = Boolean(apiKey);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [ipEnabled, setIpEnabled] = useState(false);
  const [whitelist, setWhitelist] = useState("");
  const [blacklist, setBlacklist] = useState("");
  const [quotaEnabled, setQuotaEnabled] = useState(false);
  const [quota, setQuota] = useState("0");
  const [rateEnabled, setRateEnabled] = useState(false);
  const [rate5h, setRate5h] = useState("0");
  const [rate1d, setRate1d] = useState("0");
  const [rate7d, setRate7d] = useState("0");
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expirationPreset, setExpirationPreset] =
    useState<ExpirationPreset>("30");
  const [expirationDate, setExpirationDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(apiKey?.name ?? "");
    setGroupId(
      apiKey?.group_id != null
        ? String(apiKey.group_id)
        : groups[0]
          ? String(groups[0].id)
          : "",
    );
    setCustomEnabled(false);
    setCustomKey("");
    const nextWhitelist = apiKey?.ip_whitelist ?? [];
    const nextBlacklist = apiKey?.ip_blacklist ?? [];
    setIpEnabled(nextWhitelist.length > 0 || nextBlacklist.length > 0);
    setWhitelist(nextWhitelist.join("\n"));
    setBlacklist(nextBlacklist.join("\n"));
    setQuotaEnabled(Number(apiKey?.quota || 0) > 0);
    setQuota(String(apiKey?.quota ?? 0));
    const hasRateLimit =
      Number(apiKey?.rate_limit_5h || 0) > 0 ||
      Number(apiKey?.rate_limit_1d || 0) > 0 ||
      Number(apiKey?.rate_limit_7d || 0) > 0;
    setRateEnabled(hasRateLimit);
    setRate5h(String(apiKey?.rate_limit_5h ?? 0));
    setRate1d(String(apiKey?.rate_limit_1d ?? 0));
    setRate7d(String(apiKey?.rate_limit_7d ?? 0));
    setExpirationEnabled(Boolean(apiKey?.expires_at));
    setExpirationPreset("custom");
    setExpirationDate(localDateTime(apiKey?.expires_at));
  }, [apiKey, groups, open]);

  const customKeyError = useMemo(() => {
    if (!customEnabled || !customKey) return "";
    if (customKey.length < 16) return "自定义密钥至少 16 个字符";
    if (!/^[A-Za-z0-9_-]+$/.test(customKey))
      return "只能使用字母、数字、下划线和连字符";
    return "";
  }, [customEnabled, customKey]);

  const submit = () => {
    const common = {
      name: name.trim(),
      group_id: Number(groupId),
      ip_whitelist: ipEnabled ? lines(whitelist) : [],
      ip_blacklist: ipEnabled ? lines(blacklist) : [],
      quota: quotaEnabled ? Math.max(0, Number(quota) || 0) : 0,
      rate_limit_5h: rateEnabled ? Math.max(0, Number(rate5h) || 0) : 0,
      rate_limit_1d: rateEnabled ? Math.max(0, Number(rate1d) || 0) : 0,
      rate_limit_7d: rateEnabled ? Math.max(0, Number(rate7d) || 0) : 0,
    };
    if (editing) {
      onSubmit({
        ...common,
        expires_at:
          expirationEnabled && expirationDate
            ? new Date(expirationDate).toISOString()
            : null,
      });
      return;
    }
    let expiresInDays: number | undefined;
    if (expirationEnabled) {
      expiresInDays =
        expirationPreset === "custom" && expirationDate
          ? Math.max(
              1,
              Math.ceil(
                (new Date(expirationDate).getTime() - Date.now()) / 86_400_000,
              ),
            )
          : Number(expirationPreset);
    }
    onSubmit({
      ...common,
      custom_key: customEnabled ? customKey.trim() : undefined,
      expires_in_days: expiresInDays,
    });
  };

  const valid =
    Boolean(name.trim()) &&
    Boolean(groupId) &&
    (!customEnabled || (Boolean(customKey) && !customKeyError)) &&
    (!expirationEnabled ||
      expirationPreset !== "custom" ||
      Boolean(expirationDate));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("hrouterPlatform.editKey", { defaultValue: "编辑 API 密钥" })
              : t("hrouterPlatform.createKeyTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="hrouter-key-name">密钥名称</Label>
              <Input
                id="hrouter-key-name"
                className="mt-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：我的 Codex"
                autoFocus
              />
            </div>
            <div>
              <Label>分组</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="选择分组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {groups.find((group) => String(group.id) === groupId)
                  ?.description || ""}
              </p>
            </div>
          </div>

          {!editing && (
            <>
              <ToggleField
                id="custom-key-toggle"
                label="自定义密钥"
                description="留空时由 HRouter 自动生成安全密钥"
                checked={customEnabled}
                onCheckedChange={setCustomEnabled}
              />
              {customEnabled && (
                <div>
                  <Label htmlFor="custom-key">自定义 Key</Label>
                  <Input
                    id="custom-key"
                    className="mt-2 font-mono"
                    value={customKey}
                    onChange={(event) => setCustomKey(event.target.value)}
                    placeholder="至少 16 位，仅字母、数字、_、-"
                  />
                  {customKeyError && (
                    <p className="mt-1 text-xs text-red-500">
                      {customKeyError}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <ToggleField
            id="ip-restriction-toggle"
            label="IP 限制"
            description="按 IP 或 CIDR 控制此密钥的访问来源"
            checked={ipEnabled}
            onCheckedChange={setIpEnabled}
          />
          {ipEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ip-whitelist">IP 白名单</Label>
                <Textarea
                  id="ip-whitelist"
                  className="mt-2 min-h-24 font-mono text-xs"
                  value={whitelist}
                  onChange={(event) => setWhitelist(event.target.value)}
                  placeholder={"每行一个 IP 或 CIDR\n192.168.1.0/24"}
                />
              </div>
              <div>
                <Label htmlFor="ip-blacklist">IP 黑名单</Label>
                <Textarea
                  id="ip-blacklist"
                  className="mt-2 min-h-24 font-mono text-xs"
                  value={blacklist}
                  onChange={(event) => setBlacklist(event.target.value)}
                  placeholder="每行一个 IP 或 CIDR"
                />
              </div>
            </div>
          )}

          <ToggleField
            id="quota-toggle"
            label="额度限制"
            description="设置此密钥最多可以消费的人民币额度，0 为不限"
            checked={quotaEnabled}
            onCheckedChange={setQuotaEnabled}
          />
          {quotaEnabled && (
            <div>
              <Label htmlFor="quota">额度上限（CNY）</Label>
              <Input
                id="quota"
                className="mt-2"
                type="number"
                min="0"
                step="0.01"
                value={quota}
                onChange={(event) => setQuota(event.target.value)}
              />
            </div>
          )}

          <ToggleField
            id="rate-limit-toggle"
            label="速率额度"
            description="分别限制 5 小时、每日和 7 日消费，0 为不限"
            checked={rateEnabled}
            onCheckedChange={setRateEnabled}
          />
          {rateEnabled && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["rate-5h", "5 小时额度", rate5h, setRate5h],
                ["rate-1d", "每日额度", rate1d, setRate1d],
                ["rate-7d", "7 日额度", rate7d, setRate7d],
              ].map(([id, label, value, setter]) => (
                <div key={id as string}>
                  <Label htmlFor={id as string}>{label as string}</Label>
                  <Input
                    id={id as string}
                    className="mt-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={value as string}
                    onChange={(event) =>
                      (setter as (value: string) => void)(event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <ToggleField
            id="expiration-toggle"
            label="密钥有效期"
            description="到期后密钥会自动失效"
            checked={expirationEnabled}
            onCheckedChange={setExpirationEnabled}
          />
          {expirationEnabled && (
            <div className="space-y-3">
              {!editing && (
                <div className="grid grid-cols-4 gap-2">
                  {(["7", "30", "90", "custom"] as ExpirationPreset[]).map(
                    (preset) => (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant={
                          expirationPreset === preset ? "default" : "outline"
                        }
                        onClick={() => setExpirationPreset(preset)}
                      >
                        {preset === "custom" ? "自定义" : `${preset} 天`}
                      </Button>
                    ),
                  )}
                </div>
              )}
              {(editing || expirationPreset === "custom") && (
                <Input
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
                />
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            data-tour="key-form-submit"
            disabled={!valid || pending}
            onClick={submit}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing
              ? t("common.save", { defaultValue: "保存" })
              : t("hrouterPlatform.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
