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

export async function login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await api.post<{ accessToken: string; expiresIn: number; user: AuthUser }>(
    "/auth/login",
    { email, password }
  );
  setToken(data.accessToken);
  return data;
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
  tradeTypes: string[];
  accountType?: "tradie" | "non_tradie";
}): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await api.post<{ accessToken: string; expiresIn: number; user: AuthUser }>("/auth/register", body);
  setToken(data.accessToken);
  return data;
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
