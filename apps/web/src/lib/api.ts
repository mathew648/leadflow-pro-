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

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const activeToken = token ?? _accessToken;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });

  if (res.status === 204) return undefined as T;

  const json = await res.json();

  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN_ERROR", err?.message ?? "An error occurred");
  }

  return json?.data ?? json;
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
