"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function EnableNotifications() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (ok) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setEnabled(Boolean(sub)))
        .catch(() => {});
    }
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast({ title: "Notifications blocked", description: "Allow notifications for this site in your browser settings.", variant: "destructive" });
        return;
      }
      const r: any = await api.get("/push/public-key");
      const publicKey = r?.publicKey ?? r?.data?.publicKey;
      if (!publicKey) {
        toast({ title: "Push isn't configured on the server yet", description: "Ask the admin to set the VAPID keys.", variant: "destructive" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await api.post("/push/subscribe", { subscription: sub.toJSON() });
      setEnabled(true);
      toast({ title: "Push notifications enabled 🔔" });
    } catch (e: any) {
      toast({ title: "Couldn't enable notifications", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast({ title: "Notifications turned off" });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-xs text-muted-foreground">Push notifications aren&apos;t supported on this browser. Install the app to your home screen for the best experience.</p>;
  }

  return (
    <div className="space-y-1.5">
      {enabled ? (
        <Button type="button" variant="outline" size="sm" onClick={disable} disabled={busy}>
          <BellOff className="w-4 h-4 mr-1.5" /> {busy ? "…" : "Turn off push notifications"}
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={enable} disabled={busy}>
          <Bell className="w-4 h-4 mr-1.5" /> {busy ? "Enabling…" : "Enable push notifications"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Get alerts on this device for new leads, approved quotes and payments — even when LeadFlow is closed.</p>
    </div>
  );
}
