import { Vonage } from "@vonage/server-sdk";
import { config } from "../config.js";

let vonage: Vonage | null = null;

function getVonage(): Vonage {
  if (!vonage) {
    vonage = new Vonage({
      apiKey: config.VONAGE_API_KEY,
      apiSecret: config.VONAGE_API_SECRET,
    });
  }
  return vonage;
}

export interface SmsPayload {
  to: string;
  body: string;
  from?: string;
}

export async function sendSms(payload: SmsPayload): Promise<{ messageId: string }> {
  const client = getVonage();
  const from = payload.from ?? config.VONAGE_FROM_NUMBER ?? "LeadFlow";

  const response = await client.sms.send({
    from,
    to: payload.to.replace(/[^0-9+]/g, ""),
    text: payload.body,
  });

  const msg = response.messages[0] as any;
  if (msg.status !== "0") {
    throw new Error(`Vonage SMS error: ${msg.errorText ?? msg["error-text"]} (status ${msg.status})`);
  }

  return { messageId: msg.messageId ?? msg["message-id"] };
}

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const parts = key.trim().split(".");
    let value: unknown = vars;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }
    return value != null ? String(value) : "";
  });
}
