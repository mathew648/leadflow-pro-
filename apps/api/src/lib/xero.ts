import { prisma } from "./prisma.js";
import { decrypt, encrypt } from "./utils.js";
import { config } from "../config.js";

const XERO_API = "https://api.xero.com/api.xro/2.0";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";

export interface XeroAuth {
  accessToken: string;
  /** Xero organisation tenant id, sent as the Xero-tenant-id header. */
  orgId: string;
}

/**
 * Returns a usable Xero access token for the given LeadFlow tenant, transparently
 * refreshing it (and persisting the rotated tokens) when it is close to expiry.
 * Throws "Xero not connected" when there is no active connection — callers should
 * treat that as a no-op, not a failure.
 */
export async function getXeroAuth(tenantId: string): Promise<XeroAuth> {
  const conn = await prisma.accountingConnection.findFirst({
    where: { tenantId, provider: "xero", status: "active" },
  });
  if (!conn?.accessToken || !conn.refreshToken || !conn.providerOrgId) {
    throw new Error("Xero not connected");
  }

  // Still valid (with a 60s safety margin) — reuse it.
  const expiresAt = conn.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > 60_000) {
    return { accessToken: decrypt(conn.accessToken), orgId: conn.providerOrgId };
  }

  // Refresh the access token using the stored refresh token.
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decrypt(conn.refreshToken),
      client_id: config.XERO_CLIENT_ID ?? "",
      client_secret: config.XERO_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) {
    await prisma.accountingConnection.update({
      where: { id: conn.id },
      data: { status: "error", lastSyncStatus: "auth_failed" },
    });
    throw new Error(`Xero token refresh failed (${res.status})`);
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

  return { accessToken: tokens.access_token, orgId: conn.providerOrgId };
}

/** Authenticated call to the Xero accounting API. Throws with Xero's error detail on failure. */
export async function xeroFetch<T = any>(auth: XeroAuth, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${XERO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Xero-tenant-id": auth.orgId,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body (rare) — fall through to error handling */
  }

  if (!res.ok) {
    const detail =
      json?.Elements?.[0]?.ValidationErrors?.[0]?.Message ??
      json?.Detail ??
      json?.Message ??
      text ??
      `HTTP ${res.status}`;
    throw new Error(`Xero ${path} failed (${res.status}): ${detail}`);
  }

  return json as T;
}
