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
  status: "active" | "inactive" | "quota_exhausted" | "expired";
  quota: number;
  quota_used: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface HRouterUsageLog {
  id: number;
  request_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens?: number;
  actual_cost: number;
  duration_ms: number | null;
  created_at: string;
}

export interface HRouterDashboardStats {
  total_api_keys: number;
  active_api_keys: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_actual_cost: number;
  today_requests: number;
  today_tokens: number;
  today_actual_cost: number;
  average_duration_ms: number;
  rpm: number;
  tpm: number;
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
  available: boolean;
}

export interface HRouterCheckoutInfo {
  methods: Record<string, HRouterPaymentMethod>;
  global_min: number;
  global_max: number;
  balance_disabled: boolean;
  balance_recharge_multiplier: number;
  recharge_fee_rate: number;
  help_text?: string;
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
  usage: (page = 1, pageSize = 20) =>
    authenticatedRequest<PaginatedResponse<HRouterUsageLog>>("GET", "/usage", {
      query: {
        page,
        page_size: pageSize,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  keys: (page = 1, pageSize = 50) =>
    authenticatedRequest<PaginatedResponse<HRouterApiKey>>("GET", "/keys", {
      query: { page, page_size: pageSize },
    }),
  createKey: (name: string) =>
    authenticatedRequest<HRouterApiKey>("POST", "/keys", {
      body: { name },
    }),
  updateKey: (id: number, updates: Record<string, unknown>) =>
    authenticatedRequest<HRouterApiKey>("PUT", `/keys/${id}`, {
      body: updates,
    }),
  deleteKey: (id: number) =>
    authenticatedRequest<{ message: string }>("DELETE", `/keys/${id}`),
  checkoutInfo: () =>
    authenticatedRequest<HRouterCheckoutInfo>("GET", "/payment/checkout-info"),
  orders: (page = 1, pageSize = 20) =>
    authenticatedRequest<PaginatedResponse<HRouterPaymentOrder>>(
      "GET",
      "/payment/orders/my",
      { query: { page, page_size: pageSize } },
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
};
