const API_BASE = "/api/v1";

interface ApiOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// Access token lives in memory only — never written to localStorage
let _accessToken: string | null = null;

export function setToken(token: string | null): void {
  _accessToken = token;
}

export function getToken(): string | null {
  return _accessToken;
}

// Silent token refresh from the httpOnly refresh-token cookie. De-duped so a burst of
// concurrent 401s triggers only one refresh. The access token expires after 15 min — so
// without this, the dashboard would 401 mid-session and lists would appear empty
// (records "vanishing" until a page reload).
let _refreshing: Promise<string | null> | null = null;
function refreshAccessTokenInline(): Promise<string | null> {
  if (!_refreshing) {
    _refreshing = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = await r.json().catch(() => ({}));
        const t = j?.data?.accessToken ?? j?.accessToken ?? null;
        if (t) _accessToken = t;
        return t;
      })
      .catch(() => null)
      .finally(() => { _refreshing = null; });
  }
  return _refreshing;
}

async function request<T>(path: string, options: ApiOptions = {}, _retried = false): Promise<T> {
  const { token, ...init } = options;

  const activeToken = token ?? _accessToken;

  const headers: Record<string, string> = {
    // Only send a JSON content-type when there's actually a body — Fastify rejects an
    // empty body that's labelled application/json (this was breaking /auth/refresh →
    // every dashboard load bounced to /login).
    ...(init.body !== undefined && init.body !== null ? { "Content-Type": "application/json" } : {}),
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });

  // Access token expired? Silently refresh from the cookie and retry once — keeps the
  // session alive so data never "vanishes" from the dashboard mid-session.
  if (
    res.status === 401 &&
    !_retried &&
    !path.startsWith("/auth/refresh") &&
    !path.startsWith("/auth/login")
  ) {
    const fresh = await refreshAccessTokenInline();
    if (fresh) return request<T>(path, { ...options, token: fresh }, true);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (json as any)?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN_ERROR", err?.message ?? "An error occurred");
  }

  return (json as any)?.data ?? json;
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>(path, { method: "GET", ...opts }),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, ...opts }),
  patch: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined, ...opts }),
  delete: <T>(path: string, opts?: ApiOptions) => request<T>(path, { method: "DELETE", ...opts }),
};

export { ApiError };
