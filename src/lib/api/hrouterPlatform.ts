import { invoke, isTauri } from "@tauri-apps/api/core";

const API_PREFIX = "/hrouter-api/v1";
const SESSION_STORAGE_KEY = "hrouter-account-session";
const SESSION_CHANGED_EVENT = "hrouter-account-session-changed";

export interface HRouterUser {
  id: number;
  username: string;
  email: string;
  balance: number;
  frozen_balance?: number;
  concurrency: number;
  status: "active" | "disabled";
  created_at: string;
}

export interface HRouterSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: HRouterUser;
}

export interface HRouterPublicSettings {
  registration_enabled: boolean;
  email_verify_enabled: boolean;
  invitation_code_enabled: boolean;
  promo_code_enabled: boolean;
  turnstile_enabled: boolean;
  tencent_captcha_enabled: boolean;
  aliyun_captcha_enabled: boolean;
  payment_enabled: boolean;
  site_name: string;
  contact_info?: string;
}

export interface HRouterApiKey {
  id: number;
  key: string;
  name: string;
  group_id: number | null;
  group?: HRouterGroup | null;
  status: "active" | "inactive" | "quota_exhausted" | "expired";
  quota: number;
  quota_used: number;
  current_concurrency?: number;
  last_used_at: string | null;
  expires_at: string | null;
  ip_whitelist?: string[];
  ip_blacklist?: string[];
  rate_limit_5h?: number;
  rate_limit_1d?: number;
  rate_limit_7d?: number;
  created_at: string;
}

export interface HRouterKeyCreateInput {
  name: string;
  group_id: number;
  custom_key?: string;
  ip_whitelist?: string[];
  ip_blacklist?: string[];
  quota?: number;
  expires_in_days?: number;
  expires_at?: string;
  rate_limit_5h?: number;
  rate_limit_1d?: number;
  rate_limit_7d?: number;
}

export interface HRouterKeyUpdateInput {
  name?: string;
  group_id?: number;
  status?: HRouterApiKey["status"];
  ip_whitelist?: string[];
  ip_blacklist?: string[];
  quota?: number;
  expires_at?: string | null;
  rate_limit_5h?: number;
  rate_limit_1d?: number;
  rate_limit_7d?: number;
}

export interface HRouterGroup {
  id: number;
  name: string;
  description?: string;
  platform: string;
  rate_multiplier: number;
  subscription_type: "standard" | "subscription" | string;
  daily_limit_usd?: number;
  weekly_limit_usd?: number;
  monthly_limit_usd?: number;
  rpm_limit?: number;
  claude_code_only?: boolean;
  max_reasoning_effort?: string;
}

export interface HRouterUsageLog {
  id: number;
  request_id: string;
  api_key_id?: number;
  group_id?: number;
  api_key?: Pick<HRouterApiKey, "id" | "name" | "key"> | null;
  group?: HRouterGroup | null;
  model: string;
  request_type?: string;
  billing_type?: number;
  billing_mode?: string;
  stream?: boolean;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens?: number;
  input_cost?: number;
  output_cost?: number;
  cache_creation_cost?: number;
  cache_read_cost?: number;
  total_cost?: number;
  actual_cost: number;
  rate_multiplier?: number;
  duration_ms: number | null;
  first_token_ms?: number | null;
  inbound_endpoint?: string;
  created_at: string;
}

export interface HRouterDashboardStats {
  total_api_keys: number;
  active_api_keys: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens?: number;
  total_cache_read_tokens?: number;
  total_tokens: number;
  total_cost?: number;
  total_actual_cost: number;
  today_requests: number;
  today_input_tokens?: number;
  today_output_tokens?: number;
  today_cache_creation_tokens?: number;
  today_cache_read_tokens?: number;
  today_tokens: number;
  today_cost?: number;
  today_actual_cost: number;
  average_duration_ms: number;
  rpm: number;
  tpm: number;
  by_platform?: Array<{
    platform: string;
    total_requests: number;
    total_tokens: number;
    total_actual_cost: number;
    today_requests: number;
    today_tokens: number;
    today_actual_cost: number;
  }>;
}

export interface HRouterUsageStats {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  total_tokens: number;
  total_cost: number;
  total_actual_cost: number;
  average_duration_ms: number;
  endpoints: Array<{
    endpoint: string;
    requests: number;
    total_tokens: number;
    cost: number;
    actual_cost: number;
  }>;
}

export interface HRouterUsageFilters {
  startDate?: string;
  endDate?: string;
  apiKeyId?: number;
  groupId?: number;
  model?: string;
  requestType?: string;
  billingType?: number;
  billingMode?: string;
}

export interface HRouterModelStat {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  actual_cost: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface HRouterPaymentMethod {
  currency?: string;
  display_name?: string;
  single_min: number;
  single_max: number;
  fee_rate: number;
  available?: boolean;
  enabled?: boolean;
}

export interface HRouterRechargeRebateTier {
  min_amount: number;
  max_amount?: number | null;
  rate: number;
}

export interface HRouterCheckoutInfo {
  methods: Record<string, HRouterPaymentMethod>;
  global_min: number;
  global_max: number;
  balance_disabled: boolean;
  balance_recharge_multiplier: number;
  recharge_fee_rate: number;
  recharge_rebate_enabled?: boolean;
  recharge_rebate_rate?: number;
  recharge_rebate_tiers?: HRouterRechargeRebateTier[];
  help_text?: string;
}

export interface HRouterModelPlazaTokenPricing {
  billing_mode?: string;
  input_price?: number | null;
  output_price?: number | null;
  cache_read_price?: number | null;
  cache_write_price?: number | null;
}

export interface HRouterModelPlazaEntry {
  name: string;
  group_id: number;
  group_name: string;
  group_description?: string;
  plaza_status?: string;
  rate_multiplier?: number;
  user_rate_multiplier?: number;
  pricing?: HRouterModelPlazaTokenPricing | null;
  official_pricing?: HRouterModelPlazaTokenPricing | null;
}

interface HRouterModelPlazaGroup {
  id: number;
  name: string;
  description?: string;
  plaza_status?: string;
  rate_multiplier?: number;
  user_rate_multiplier?: number;
  models?: Array<
    Omit<
      HRouterModelPlazaEntry,
      | "group_id"
      | "group_name"
      | "group_description"
      | "plaza_status"
      | "rate_multiplier"
      | "user_rate_multiplier"
    >
  >;
}

interface HRouterModelPlazaResponse {
  groups?: HRouterModelPlazaGroup[];
}

export interface HRouterPaymentOrder {
  id: number;
  amount: number;
  pay_amount: number;
  currency?: string;
  payment_type: string;
  out_trade_no: string;
  status: string;
  order_type: string;
  created_at: string;
  expires_at: string;
}

export interface HRouterAffiliateInvitee {
  id?: number;
  username?: string;
  email?: string;
  created_at?: string;
  total_recharged?: number;
  rebate_amount?: number;
}

export interface HRouterAffiliateInfo {
  user_id: number;
  aff_code: string;
  aff_count: number;
  aff_quota: number;
  aff_frozen_quota: number;
  aff_history_quota: number;
  effective_rebate_rate_percent: number;
  invitees: HRouterAffiliateInvitee[];
}

export interface HRouterOrderResult {
  order_id: number;
  pay_url?: string;
  qr_code?: string;
  amount: number;
  pay_amount: number;
  payment_type?: string;
  out_trade_no?: string;
  expires_at: string;
}

interface PlatformResponse {
  status: number;
  data: unknown;
}

interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user: HRouterUser;
  requires_2fa?: boolean;
}

interface RefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export class HRouterApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string | number,
  ) {
    super(message);
    this.name = "HRouterApiError";
  }
}

function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function getHRouterSession(): HRouterSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as HRouterSession;
    return session.accessToken && session.user ? session : null;
  } catch {
    return null;
  }
}

export function saveHRouterSession(session: HRouterSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  notifySessionChanged();
}

export function clearHRouterSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  notifySessionChanged();
}

export function subscribeHRouterSession(listener: () => void) {
  window.addEventListener(SESSION_CHANGED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SESSION_CHANGED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function errorFromPayload(status: number, payload: unknown) {
  const value =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const message =
    (typeof value.message === "string" && value.message) ||
    (typeof value.detail === "string" && value.detail) ||
    `HRouter 请求失败 (${status})`;
  const code =
    typeof value.code === "string" || typeof value.code === "number"
      ? value.code
      : undefined;
  return new HRouterApiError(message, status, code);
}

function unwrapResponse<T>(response: PlatformResponse): T {
  const envelope =
    response.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : null;
  if (response.status < 200 || response.status >= 300) {
    throw errorFromPayload(response.status, envelope);
  }
  if (envelope && "code" in envelope) {
    if (envelope.code !== 0) {
      throw errorFromPayload(response.status, envelope);
    }
    return envelope.data as T;
  }
  return response.data as T;
}

async function rawRequest(
  method: string,
  path: string,
  options: {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    accessToken?: string;
  } = {},
): Promise<PlatformResponse> {
  const query = Object.fromEntries(
    Object.entries(options.query ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  if (isTauri()) {
    return invoke<PlatformResponse>("hrouter_platform_request", {
      request: {
        method,
        path,
        query,
        body: options.body,
        accessToken: options.accessToken,
        locale: navigator.language,
      },
    });
  }

  const url = new URL(`${API_PREFIX}${path}`, window.location.origin);
  Object.entries(query).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, data: await response.json() };
}

let refreshInFlight: Promise<HRouterSession> | null = null;

async function refreshSession(
  session: HRouterSession,
): Promise<HRouterSession> {
  if (!session.refreshToken) {
    clearHRouterSession();
    throw new HRouterApiError("登录已过期，请重新登录", 401);
  }
  if (!refreshInFlight) {
    refreshInFlight = rawRequest("POST", "/auth/refresh", {
      body: { refresh_token: session.refreshToken },
    })
      .then((response) => unwrapResponse<RefreshResponse>(response))
      .then((tokens) => {
        const nextSession: HRouterSession = {
          ...session,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? session.refreshToken,
          expiresAt: tokens.expires_in
            ? Date.now() + tokens.expires_in * 1000
            : undefined,
        };
        saveHRouterSession(nextSession);
        return nextSession;
      })
      .catch((error) => {
        clearHRouterSession();
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function authenticatedRequest<T>(
  method: string,
  path: string,
  options: {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
  } = {},
): Promise<T> {
  let session = getHRouterSession();
  if (!session) throw new HRouterApiError("请先登录 HRouter", 401);
  if (session.expiresAt && session.expiresAt <= Date.now() + 60_000) {
    session = await refreshSession(session);
  }

  let response = await rawRequest(method, path, {
    ...options,
    accessToken: session.accessToken,
  });
  if (response.status === 401 && session.refreshToken) {
    session = await refreshSession(session);
    response = await rawRequest(method, path, {
      ...options,
      accessToken: session.accessToken,
    });
  }
  if (response.status === 401) clearHRouterSession();
  return unwrapResponse<T>(response);
}

function sessionFromAuth(data: AuthResponse): HRouterSession {
  if (data.requires_2fa) {
    throw new HRouterApiError(
      "当前账户需要二次验证，请先在 HRouter.net 登录",
      409,
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
    user: data.user,
  };
}

export const hrouterAuthApi = {
  async publicSettings() {
    return unwrapResponse<HRouterPublicSettings>(
      await rawRequest("GET", "/settings/public"),
    );
  },
  async login(email: string, password: string) {
    const data = unwrapResponse<AuthResponse>(
      await rawRequest("POST", "/auth/login", { body: { email, password } }),
    );
    const session = sessionFromAuth(data);
    saveHRouterSession(session);
    return session;
  },
  async sendVerifyCode(email: string) {
    return unwrapResponse<{ message: string; countdown: number }>(
      await rawRequest("POST", "/auth/send-verify-code", {
        body: { email },
      }),
    );
  },
  async register(email: string, password: string, verifyCode?: string) {
    const data = unwrapResponse<AuthResponse>(
      await rawRequest("POST", "/auth/register", {
        body: {
          email,
          password,
          ...(verifyCode ? { verify_code: verifyCode } : {}),
        },
      }),
    );
    const session = sessionFromAuth(data);
    saveHRouterSession(session);
    return session;
  },
  async restore() {
    const user = await authenticatedRequest<HRouterUser>("GET", "/auth/me");
    const session = getHRouterSession();
    if (!session) throw new HRouterApiError("请先登录 HRouter", 401);
    const nextSession = { ...session, user };
    saveHRouterSession(nextSession);
    return nextSession;
  },
  async logout() {
    const session = getHRouterSession();
    try {
      if (session?.refreshToken) {
        await authenticatedRequest("POST", "/auth/logout", {
          body: { refresh_token: session.refreshToken },
        });
      }
    } finally {
      clearHRouterSession();
    }
  },
};

export const hrouterAccountApi = {
  async profile() {
    const user = await authenticatedRequest<HRouterUser>(
      "GET",
      "/user/profile",
    );
    const session = getHRouterSession();
    if (session) saveHRouterSession({ ...session, user });
    return user;
  },
  dashboardStats: () =>
    authenticatedRequest<HRouterDashboardStats>(
      "GET",
      "/usage/dashboard/stats",
    ),
  modelStats: (startDate?: string, endDate?: string) =>
    authenticatedRequest<{ models: HRouterModelStat[] }>(
      "GET",
      "/usage/dashboard/models",
      {
        query: {
          start_date: startDate,
          end_date: endDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    ),
  usage: (page = 1, pageSize = 20, filters: HRouterUsageFilters = {}) =>
    authenticatedRequest<PaginatedResponse<HRouterUsageLog>>("GET", "/usage", {
      query: {
        page,
        page_size: pageSize,
        start_date: filters.startDate,
        end_date: filters.endDate,
        api_key_id: filters.apiKeyId,
        group_id: filters.groupId,
        model: filters.model,
        request_type: filters.requestType,
        billing_type: filters.billingType,
        billing_mode: filters.billingMode,
        sort_by: "created_at",
        sort_order: "desc",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  usageStats: (
    startDate?: string,
    endDate?: string,
    filters: HRouterUsageFilters = {},
  ) =>
    authenticatedRequest<HRouterUsageStats>("GET", "/usage/stats", {
      query: {
        start_date: startDate,
        end_date: endDate,
        api_key_id: filters.apiKeyId,
        group_id: filters.groupId,
        model: filters.model,
        request_type: filters.requestType,
        billing_type: filters.billingType,
        billing_mode: filters.billingMode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  groups: () =>
    authenticatedRequest<HRouterGroup[]>("GET", "/groups/available"),
  keys: (page = 1, pageSize = 50) =>
    authenticatedRequest<PaginatedResponse<HRouterApiKey>>("GET", "/keys", {
      query: { page, page_size: pageSize },
    }),
  createKey: (input: HRouterKeyCreateInput) =>
    authenticatedRequest<HRouterApiKey>("POST", "/keys", {
      body: input,
    }),
  updateKey: (id: number, updates: HRouterKeyUpdateInput) =>
    authenticatedRequest<HRouterApiKey>("PUT", `/keys/${id}`, {
      body: updates,
    }),
  deleteKey: (id: number) =>
    authenticatedRequest<{ message: string }>("DELETE", `/keys/${id}`),
  checkoutInfo: () =>
    authenticatedRequest<HRouterCheckoutInfo>("GET", "/payment/checkout-info"),
  async modelPlaza() {
    const response = await authenticatedRequest<HRouterModelPlazaResponse>(
      "GET",
      "/model-plaza",
    );
    return (response.groups ?? []).flatMap((group) =>
      (group.models ?? []).map((model) => ({
        ...model,
        group_id: group.id,
        group_name: group.name,
        group_description: group.description,
        plaza_status: group.plaza_status,
        rate_multiplier: group.rate_multiplier,
        user_rate_multiplier: group.user_rate_multiplier,
      })),
    );
  },
  affiliate: () =>
    authenticatedRequest<HRouterAffiliateInfo>("GET", "/user/aff"),
  transferAffiliate: () =>
    authenticatedRequest<Record<string, unknown>>("POST", "/user/aff/transfer"),
  redeemCode: (code: string) =>
    authenticatedRequest<Record<string, unknown>>("POST", "/redeem", {
      body: { code },
    }),
  orders: (page = 1, pageSize = 20, status?: string) =>
    authenticatedRequest<PaginatedResponse<HRouterPaymentOrder>>(
      "GET",
      "/payment/orders/my",
      { query: { page, page_size: pageSize, status } },
    ),
  createOrder: (amount: number, paymentType: string) =>
    authenticatedRequest<HRouterOrderResult>("POST", "/payment/orders", {
      body: {
        amount,
        payment_type: paymentType,
        order_type: "balance",
        payment_source: "hrouter-desktop",
        is_mobile: false,
        return_url: "https://hrouter.net/payment/result",
      },
    }),
  cancelOrder: (id: number) =>
    authenticatedRequest("POST", `/payment/orders/${id}/cancel`),
  async updateProfile(username: string) {
    await authenticatedRequest("PUT", "/user", {
      body: { username },
    });
    const user = await authenticatedRequest<HRouterUser>(
      "GET",
      "/user/profile",
    );
    const session = getHRouterSession();
    if (session) saveHRouterSession({ ...session, user });
    return user;
  },
  changePassword: (oldPassword: string, newPassword: string) =>
    authenticatedRequest<{ message?: string }>("PUT", "/user/password", {
      body: { old_password: oldPassword, new_password: newPassword },
    }),
};
