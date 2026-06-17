import { config } from "../config.js";

/** True when the email is in the PLATFORM_ADMIN_EMAILS allowlist (super-admins). */
export function isPlatformAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allow = config.PLATFORM_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
