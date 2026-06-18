import { config } from "../config.js";

/**
 * Send a WhatsApp message via Twilio. Graceful no-op when not configured.
 * Used by the platform admin to message tradies.
 */
export async function sendWhatsApp(to: string, body: string): Promise<{ sent: boolean; reason?: string }> {
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_WHATSAPP_FROM) {
    return { sent: false, reason: "WhatsApp isn't configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM." };
  }
  if (!to) return { sent: false, reason: "No phone number on file" };

  const wa = (n: string) => (n.startsWith("whatsapp:") ? n : `whatsapp:${n}`);
  const auth = Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: wa(to), From: wa(config.TWILIO_WHATSAPP_FROM), Body: body }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { sent: false, reason: `Twilio: ${txt.slice(0, 160)}` };
    }
    return { sent: true };
  } catch (err: any) {
    return { sent: false, reason: err?.message ?? "WhatsApp send failed" };
  }
}
