"use client";
import { api, setToken, getToken } from "./api";

export { getToken as getAccessToken };

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  isPlatformAdmin?: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    accountType?: string;
    country: string;
    currency: string;
    timezone: string;
    logoUrl?: string;
    primaryColor?: string;
    onboardingStep?: string;
    settings?: Record<string, unknown>;
  };
}

// A login either completes (tokens + user) or requires an emailed 2FA code (owners/admins).
export type LoginResult =
  | { requiresOtp: true; challengeId: string; email: string }
  | { requiresOtp?: false; accessToken: string; user: AuthUser };

export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await api.post<LoginResult>("/auth/login", { email, password });
  if ("requiresOtp" in data && data.requiresOtp) return data;
  setToken((data as { accessToken: string }).accessToken);
  return data;
}

// Second step of email 2FA — exchange the emailed code for a session.
export async function verifyLoginOtp(
  challengeId: string,
  code: string,
  rememberDevice: boolean
): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await api.post<{ accessToken: string; expiresIn: number; user: AuthUser }>(
    "/auth/login/verify-otp",
    { challengeId, code, rememberDevice }
  );
  setToken(data.accessToken);
  return data;
}

// Reissue a fresh code for an in-progress 2FA login. Returns the new challenge id.
export async function resendLoginOtp(challengeId: string): Promise<{ challengeId: string; email: string }> {
  return api.post<{ challengeId: string; email: string }>("/auth/login/resend-otp", { challengeId });
}

export async function register(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  businessName: string;
  abn?: string;
  phone?: string;
  country: "AU" | "NZ";
  timezone?: string;
  tradeTypes: string[];
  accountType?: "tradie" | "non_tradie";
  referralCode?: string;
}): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await api.post<{ accessToken: string; expiresIn: number; user: AuthUser }>("/auth/register", body);
  setToken(data.accessToken);
  return data;
}

export interface InviteInfo { firstName: string; lastName: string; email: string; role: string; businessName: string; }

export async function getInvite(token: string): Promise<InviteInfo> {
  return api.get<InviteInfo>(`/auth/accept-invite?token=${encodeURIComponent(token)}`);
}

export async function acceptInvite(token: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await api.post<{ accessToken: string; expiresIn: number; user: AuthUser }>(
    "/auth/accept-invite",
    { token, password }
  );
  setToken(data.accessToken);
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post("/auth/reset-password", { token, password });
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {}
  setToken(null);
}

export async function getMe(): Promise<AuthUser> {
  return api.get<AuthUser>("/auth/me");
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const data = await api.post<{ accessToken: string }>("/auth/refresh");
    setToken(data.accessToken);
    return data.accessToken;
  } catch {
    setToken(null);
    return null;
  }
}
