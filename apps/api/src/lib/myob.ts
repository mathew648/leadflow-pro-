import { prisma } from "./prisma.js";
import { decrypt, encrypt } from "./utils.js";
import { config } from "../config.js";

const MYOB_TOKEN_URL = "https://secure.myob.com/oauth2/v1/authorize";
export const MYOB_AUTH_URL = "https://secure.myob.com/oauth2/account/authorize";
export const MYOB_API_BASE = "https://api.myob.com/accountright";

export interface MyobAuth {
  accessToken: string;
  /** Company file URI stored on the connection (providerOrgId). */
  companyFileUri: string;
}

/**
 * Returns a usable MYOB access token, refreshing it (and persisting the rotated tokens)
 * when close to expiry. Throws "MYOB not connected" when there's no active connection —
 * callers should treat that as a no-op, not a failure.
 */
export async function getMyobAuth(tenantId: string): Promise<MyobAuth> {
  const conn = await prisma.accountingConnection.findFirst({
    where: { tenantId, provider: "myob", status: "active" },
  });
  if (!conn?.accessToken || !conn.refreshToken || !conn.providerOrgId) {
    throw new Error("MYOB not connected");
  }

  const expiresAt = conn.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > 60_000) {
    return { accessToken: decrypt(conn.accessToken), companyFileUri: conn.providerOrgId };
  }

  const res = await fetch(MYOB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decrypt(conn.refreshToken),
      client_id: config.MYOB_CLIENT_ID ?? "",
      client_secret: config.MYOB_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    await prisma.accountingConnection.update({
      where: { id: conn.id },
      data: { status: "error", lastSyncStatus: "auth_failed" },
    });
    throw new Error(`MYOB token refresh failed (${res.status})`);
  }

  const tokens = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  await prisma.accountingConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return { accessToken: tokens.access_token, companyFileUri: conn.providerOrgId };
}

/** Authenticated call to the MYOB AccountRight API for a company file. */
export async function myobFetch<T = any>(auth: MyobAuth, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${auth.companyFileUri}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "x-myobapi-key": config.MYOB_CLIENT_ID ?? "",
      "x-myobapi-version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = json?.Errors?.[0]?.Message ?? json?.Message ?? text ?? `HTTP ${res.status}`;
    throw new Error(`MYOB ${path} failed (${res.status}): ${detail}`);
  }
  return json as T;
}

/** POST to MYOB and return the new record's UID, which MYOB returns in the Location header. */
export async function myobCreate(auth: MyobAuth, path: string, body: unknown): Promise<string | null> {
  const res = await fetch(`${auth.companyFileUri}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "x-myobapi-key": config.MYOB_CLIENT_ID ?? "",
      "x-myobapi-version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MYOB POST ${path} failed (${res.status}): ${text}`);
  }
  // MYOB returns 201 with the new resource URL in Location; the UID is the last segment.
  const location = res.headers.get("location") ?? "";
  const uid = location.split("/").pop() ?? null;
  return uid;
}
