import { getJSON, setJSON } from "@/lib/db";

export async function POST(req) {
  const { endpoint } = await req.json();
  const subs = await getJSON("push-subs", []);
  const next = subs.filter((s) => s.endpoint !== endpoint);
  await setJSON("push-subs", next);
  return Response.json({ ok: true });
}
