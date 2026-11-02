"use client";

export type PushState = "on" | "off" | "denied" | "unsupported" | "not-installed" | "no-key";

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (isIos() && !isStandalone()) return "not-installed";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return "off";
    return "on";
  } catch {
    return "off";
  }
}

export async function enablePushNotifications(): Promise<{ ok: boolean; state: PushState; message?: string }> {
  if (!pushSupported()) return { ok: false, state: "unsupported" };
  if (isIos() && !isStandalone()) return { ok: false, state: "not-installed" };

  // Ask for permission immediately in the user's tap so iOS keeps the gesture.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, state: permission === "denied" ? "denied" : "off" };
  }

  const keyResponse = await fetch("/api/push", { credentials: "same-origin" });
  const keyData = (await keyResponse.json()) as { publicKey: string | null };
  if (!keyData.publicKey) return { ok: false, state: "no-key" };

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }

  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) return { ok: false, state: "off" };
  await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ pushEnabled: true }),
  }).catch(() => undefined);
  return { ok: true, state: "on" };
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pushEnabled: false }),
      }).catch(() => undefined);
    }
  } catch {
    // best effort
  }
}
