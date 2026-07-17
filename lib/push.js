import webpush from "web-push";
import { getJSON, setJSON } from "./db";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:example@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Sends a notification to every stored subscription (both phones).
// Automatically drops subscriptions that are no longer valid (410/404).
export async function broadcastPush(title, body) {
  ensureConfigured();
  const subs = await getJSON("push-subs", []);
  if (!subs.length) return { sent: 0 };

  const payload = JSON.stringify({ title, body });
  const stillValid = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        stillValid.push(sub);
        sent++;
      } catch (err) {
        if (err.statusCode !== 410 && err.statusCode !== 404) {
          stillValid.push(sub);
        }
        // 410/404 means the subscription is dead — drop it silently
      }
    })
  );

  if (stillValid.length !== subs.length) {
    await setJSON("push-subs", stillValid);
  }

  return { sent };
}
