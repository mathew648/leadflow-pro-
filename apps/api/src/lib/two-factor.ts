import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export const OTP_TTL_SECONDS = 300; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;

const TRUSTED_DEVICE_COOKIE = "tj_td";
const TRUSTED_DEVICE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds

// Email 2FA is mandatory for owners and admins only — technicians and lower roles log in
// normally. The global kill-switch (EMAIL_2FA_ENABLED) can turn it off entirely.
export function requiresEmail2FA(role: string): boolean {
  return config.EMAIL_2FA_ENABLED && (role === "owner" || role === "admin");
}

/** A zero-padded 6-digit code, generated with a CSPRNG (uniform, no modulo bias). */
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

// A trusted-device cookie lets one specific user skip the emailed code on this browser for
// 30 days ("remember this device"). It's a signed JWT bound to the user id, so it can't be
// forged; and it only ever bypasses the second factor — the password is still required.
export function setTrustedDeviceCookie(fastify: FastifyInstance, reply: FastifyReply, userId: string): void {
  const token = fastify.jwt.sign({ sub: userId, kind: "trusted_device" } as any, { expiresIn: TRUSTED_DEVICE_MAX_AGE });
  reply.setCookie(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: TRUSTED_DEVICE_MAX_AGE,
    path: "/api/v1/auth",
  });
}

export function hasTrustedDeviceCookie(fastify: FastifyInstance, request: FastifyRequest, userId: string): boolean {
  const raw = request.cookies?.[TRUSTED_DEVICE_COOKIE];
  if (!raw) return false;
  try {
    const payload = fastify.jwt.verify(raw) as { sub?: string; kind?: string };
    return payload?.kind === "trusted_device" && payload?.sub === userId;
  } catch {
    return false;
  }
}

/** Masks an address for display ("ma••••••@webmaniacs.co.nz") so we can show where the code went. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(1, local.length - shown.length))}@${domain}`;
}
