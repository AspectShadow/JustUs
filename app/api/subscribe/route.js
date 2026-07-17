import { getJSON, setJSON } from "@/lib/db";

export async function POST(req) {
  const { subscription } = await req.json();
  if (!subscription || !subscription.endpoint) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const subs = await getJSON("push-subs", []);
  const exists = subs.some((s) => s.endpoint === subscription.endpoint);
  const next = exists ? subs : [...subs, subscription];
  if (!exists) await setJSON("push-subs", next);

  return Response.json({ ok: true, total: next.length });
}
