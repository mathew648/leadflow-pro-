import webpush from "web-push";
import { prisma } from "./prisma.js";
import { config } from "../config.js";

let configured = false;

/** Lazily configure web-push with VAPID details; returns false if keys aren't set. */
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Send a push to every subscription for a tenant's users. Best-effort; prunes dead subs. */
export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { tenantId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        sent += 1;
      } catch (err: any) {
        // 404/410 → subscription expired/unsubscribed; remove it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
  return sent;
}
