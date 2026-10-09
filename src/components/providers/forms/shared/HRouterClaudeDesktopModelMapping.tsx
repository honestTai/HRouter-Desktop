import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelInputWithFetch } from "./ModelInputWithFetch";
import type { FetchedModel } from "@/lib/api/model-fetch";
import {
  isHRouterDesktopModelId,
  type HRouterDesktopRoute,
} from "@/lib/hrouterClaudeDesktop";

interface Props {
  rows: HRouterDesktopRoute[];
  models: FetchedModel[];
  primary: string;
  onPrimaryChange: (model: string) => void;
  onChange: (rows: HRouterDesktopRoute[]) => void;
  onRecommend: () => void;
  disabled?: boolean;
}

export function HRouterClaudeDesktopModelMapping({
  rows,
  models,
  primary,
  onPrimaryChange,
  onChange,
  onRecommend,
  disabled,
}: Props) {
  const update = (index: number, patch: Partial<HRouterDesktopRoute>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          客户端模型 ID 决定 Claude Desktop 识别的模型能力和思考菜单；上游模型
          ID 才是 HRouter 实际请求的模型。菜单显示名只改名称，不改变能力。
        </p>
        <p className="mt-1">
          默认对可识别的 Claude 模型使用同名 ID。思考档位仍取决于 Claude
          客户端版本和上游支持；不要用更新的模型 ID 冒充旧模型的能力。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !models.length}
          onClick={onRecommend}
        >
          按已导入列表重新推荐
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...rows, { routeId: "", model: "" }])}
        >
          添加模型映射
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        重新推荐会替换下方映射：按版本号选择各角色的最新可用模型。导入列表和打开编辑不会覆盖已保存的手动映射。
      </p>
      {primary.trim() &&
        rows.length > 0 &&
        !rows.some((row) => row.model.trim() === primary.trim()) && (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            <p>
              默认模型「{primary}
              」未包含在当前映射中。请添加对应映射，或在下方重新选择默认模型；不会静默替换已保存的默认值。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() =>
                onChange([
                  ...rows,
                  {
                    routeId: isHRouterDesktopModelId(primary)
                      ? primary.trim()
                      : "",
                    model: primary.trim(),
                    labelOverride: primary.trim(),
                  },
                ])
              }
            >
              添加默认模型映射
            </Button>
          </div>
        )}
      {rows.map((row, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant={
                row.model.trim() === primary.trim() ? "secondary" : "outline"
              }
              size="sm"
              aria-label={`将映射 ${index + 1} 设为默认模型`}
              aria-pressed={
                Boolean(row.model.trim()) && row.model.trim() === primary.trim()
              }
              disabled={disabled || !row.model.trim()}
              onClick={() => onPrimaryChange(row.model.trim())}
            >
              {row.model.trim() && row.model.trim() === primary.trim()
                ? "默认模型"
                : "设为默认模型"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={`删除映射 ${index + 1}`}
              onClick={() => {
                const next = rows.filter((_, i) => i !== index);
                onChange(next);
                if (
                  row.model.trim() === primary.trim() &&
                  !next.some((item) => item.model.trim() === primary.trim())
                )
                  onPrimaryChange(next[0]?.model ?? "");
              }}
            >
              删除
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`hrouter-desktop-route-${index}`}>
                客户端模型 ID
              </Label>
              <Input
                id={`hrouter-desktop-route-${index}`}
                value={row.routeId}
                disabled={disabled}
                placeholder="claude-haiku-5-5"
                onChange={(event) =>
                  update(index, { routeId: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`hrouter-desktop-upstream-${index}`}>
                上游模型 ID
              </Label>
              <ModelInputWithFetch
                id={`hrouter-desktop-upstream-${index}`}
                value={row.model}
                fetchedModels={models}
                isLoading={false}
                onChange={(model) => {
                  const followsModel =
                    !row.routeId || row.routeId === row.model;
                  update(index, {
                    model,
                    ...(followsModel && isHRouterDesktopModelId(model)
                      ? { routeId: model }
                      : {}),
                    ...(!row.labelOverride || row.labelOverride === row.model
                      ? { labelOverride: model }
                      : {}),
                  });
                  if (row.model.trim() === primary.trim() || !primary.trim())
                    onPrimaryChange(model);
                }}
              />
            </div>
          </div>
          {row.routeId.trim() !== row.model.trim() && row.model.trim() && (
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
              <p>
                映射不一致：Claude Desktop 按「{row.routeId || "未填写"}
                」识别能力，实际请求「{row.model}」。显示名称不会修正思考菜单。
              </p>
              {isHRouterDesktopModelId(row.model) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => update(index, { routeId: row.model.trim() })}
                >
                  使用同名客户端 ID
                </Button>
              )}
            </div>
          )}
          <div className="grid items-center gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`hrouter-desktop-label-${index}`}>
                菜单显示名（可选）
              </Label>
              <Input
                id={`hrouter-desktop-label-${index}`}
                value={row.labelOverride ?? ""}
                disabled={disabled}
                placeholder="仅改变显示名称"
                onChange={(event) =>
                  update(index, { labelOverride: event.target.value })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={row.supports1m ?? false}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  update(index, { supports1m: checked === true })
                }
              />
              声明支持 1M 上下文（须由上游支持）
            </label>
          </div>
        </div>
      ))}
    </fieldset>
  );
}
