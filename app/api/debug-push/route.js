import webpush from "web-push";
import { getJSON } from "@/lib/db";

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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  ensureConfigured();
  const subs = await getJSON("push-subs", []);

  const results = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        sub,
        JSON.stringify({ title: "Debug test", body: "If you see this, push works!" })
      );
      results.push({ endpoint: sub.endpoint.slice(0, 60) + "...", ok: true });
    } catch (err) {
      results.push({
        endpoint: sub.endpoint.slice(0, 60) + "...",
        ok: false,
        statusCode: err.statusCode,
        message: err.message,
        body: err.body,
      });
    }
  }

  return Response.json({ subscriptionCount: subs.length, results });
}
