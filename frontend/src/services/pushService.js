import { API_BASE_URL } from "../config";

const url = `${API_BASE_URL}/push`;

function decodeApplicationServerKey(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function getPushStatus() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return { supported: false, permission: "unsupported", subscribed: false };

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  return { supported: true, permission: Notification.permission, subscribed: Boolean(subscription) };
}

export async function enablePushNotifications(token) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Ce navigateur ne prend pas en charge les notifications Push.");
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Les notifications sont bloquées dans les réglages du navigateur."
      : "Autorise les notifications pour les activer.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const keyResponse = await fetch(`${url}/vapid-public-key`);
  const keyData = await keyResponse.json();
  if (!keyResponse.ok || !keyData.publicKey) {
    throw new Error(keyData.message || "Le serveur Push n’est pas encore configuré.");
  }

  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(keyData.publicKey),
    });

  const response = await fetch(`${url}/subscriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Impossible d’enregistrer cet appareil.");
  return subscription;
}

export async function disablePushNotifications(token) {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;

  try {
    await fetch(`${url}/subscriptions`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } finally {
    await subscription.unsubscribe();
  }
}
