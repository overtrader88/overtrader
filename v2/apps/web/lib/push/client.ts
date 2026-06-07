/**
 * Helpers de Web Push no CLIENTE: registra o service worker, pede permissão,
 * assina o PushManager com a chave VAPID pública e envia a inscrição ao backend.
 * Tudo gracioso: navegadores sem suporte/sem chave retornam status explícito.
 */
export type PushStatus = "ok" | "unsupported" | "denied" | "no_vapid" | "error";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return "no_vapid";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch { /* gracioso */ }
}

/** Notifica o backend que uma confluência REFORÇADA apareceu (envia push). */
export async function notifyReinforced(p: { symbol: string; timeframe: string; side: string; verdict: string }): Promise<void> {
  try {
    await fetch("/api/push/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  } catch { /* gracioso */ }
}
