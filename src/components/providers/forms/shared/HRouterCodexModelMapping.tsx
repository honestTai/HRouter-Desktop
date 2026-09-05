import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CodexCatalogModel } from "@/types";
import type { FetchedModel } from "@/lib/api/model-fetch";
import { ModelInputWithFetch } from "./ModelInputWithFetch";

export function HRouterCodexModelMapping({
  rows,
  models,
  onChange,
}: {
  rows: CodexCatalogModel[];
  models: FetchedModel[];
  onChange: (rows: CodexCatalogModel[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Codex 模型映射</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { model: "" }])}
        >
          添加模型映射
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        显示名称用于模型菜单；实际模型 ID 会原样发送给 HRouter。可选择 Key
        返回的模型，也可手动填写别名。默认模型会自动保留在目录中。
      </p>
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`hrouter-catalog-name-${index}`}>
                显示名称 {index + 1}
              </Label>
              <Input
                id={`hrouter-catalog-name-${index}`}
                value={row.displayName ?? ""}
                placeholder="留空使用实际模型 ID"
                onChange={(event) =>
                  onChange(
                    rows.map((item, i) =>
                      i === index
                        ? { ...item, displayName: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`hrouter-catalog-model-${index}`}>
                实际模型 ID {index + 1}
              </Label>
              <ModelInputWithFetch
                id={`hrouter-catalog-model-${index}`}
                value={row.model}
                fetchedModels={models}
                isLoading={false}
                onChange={(model) =>
                  onChange(
                    rows.map((item, i) =>
                      i === index ? { ...item, model } : item,
                    ),
                  )
                }
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`删除模型映射 ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            删除
          </Button>
        </div>
      ))}
    </div>
  );
}
