import { usageApi } from "@/lib/api/usage";
import {
  formatPrice,
  normalizeModelIdForPricing,
} from "@/lib/modelsDevPricing";
import type { ModelPricing } from "@/types/usage";

export const HROUTER_MODEL_PLAZA_URL = "https://hrouter.net/api/v1/model-plaza";
export const HROUTER_MODEL_PLAZA_QUERY_KEY = [
  "hrouter-model-plaza-pricing",
] as const;

const TOKENS_PER_MILLION = 1_000_000;

interface PlazaTokenPricing {
  billing_mode?: string;
  input_price?: number | null;
  output_price?: number | null;
  cache_write_price?: number | null;
  cache_read_price?: number | null;
}

interface PlazaModel {
  name?: string;
  pricing?: PlazaTokenPricing | null;
}

interface PlazaGroup {
  plaza_status?: string;
  purchasable?: boolean;
  models?: PlazaModel[];
}

interface PlazaResponse {
  code?: number;
  message?: string;
  data?: {
    display_currency?: string;
    description?: string;
    groups?: PlazaGroup[];
  };
}

export interface HRouterModelPlazaPricing {
  displayCurrency: "CNY";
  description: string;
  pricing: ModelPricing[];
}

function pricePerMillion(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "0";
  }
  return formatPrice(value * TOKENS_PER_MILLION);
}

export function parseHRouterModelPlazaPricing(
  response: PlazaResponse,
): HRouterModelPlazaPricing {
  if (response.code !== 0 || !response.data) {
    throw new Error(response.message || "模型广场返回了无效数据");
  }
  if (response.data.display_currency?.toUpperCase() !== "CNY") {
    throw new Error("模型广场价格不是人民币计价，已停止同步");
  }

  const groups = [...(response.data.groups ?? [])].sort((left, right) => {
    const score = (group: PlazaGroup) =>
      Number(group.purchasable === true) +
      Number(group.plaza_status === "live");
    return score(right) - score(left);
  });
  const byModelId = new Map<string, ModelPricing>();

  for (const group of groups) {
    for (const model of group.models ?? []) {
      const modelId = normalizeModelIdForPricing(model.name ?? "");
      const pricing = model.pricing;
      if (!modelId || !pricing || pricing.billing_mode !== "token") continue;
      if (byModelId.has(modelId)) continue;

      const hasTokenPrice =
        typeof pricing.input_price === "number" ||
        typeof pricing.output_price === "number";
      if (!hasTokenPrice) continue;

      byModelId.set(modelId, {
        modelId,
        displayName: model.name?.trim() || modelId,
        inputCostPerMillion: pricePerMillion(pricing.input_price),
        outputCostPerMillion: pricePerMillion(pricing.output_price),
        cacheReadCostPerMillion: pricePerMillion(pricing.cache_read_price),
        cacheCreationCostPerMillion: pricePerMillion(pricing.cache_write_price),
      });
    }
  }

  if (byModelId.size === 0) {
    throw new Error("模型广场未返回可用的 Token 价格");
  }

  return {
    displayCurrency: "CNY",
    description: response.data.description ?? "",
    pricing: Array.from(byModelId.values()),
  };
}

export async function fetchHRouterModelPlazaPricing(): Promise<HRouterModelPlazaPricing> {
  const response = await usageApi.fetchHRouterModelPlaza();
  return parseHRouterModelPlazaPricing(response as PlazaResponse);
}

export interface HRouterModelPlazaSyncResult extends HRouterModelPlazaPricing {
  changed: number;
}

export async function syncHRouterModelPlazaPricing(): Promise<HRouterModelPlazaSyncResult> {
  const result = await fetchHRouterModelPlazaPricing();
  const changed = await usageApi.updateModelPricingBatch(result.pricing);
  return { ...result, changed };
}
