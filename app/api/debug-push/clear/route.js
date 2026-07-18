import { setJSON } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await setJSON("push-subs", []);
  return Response.json({ ok: true, message: "All subscriptions cleared" });
}
