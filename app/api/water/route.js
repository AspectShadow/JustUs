import { getJSON, setJSON } from "@/lib/db";

const DEFAULT_WATER = { enabled: false, lastDrink: Date.now(), lastNotifiedAt: 0 };

export async function GET() {
  const water = await getJSON("water", DEFAULT_WATER);
  return Response.json({ water });
}

export async function POST(req) {
  const { water } = await req.json();
  await setJSON("water", { ...DEFAULT_WATER, ...water });
  return Response.json({ ok: true });
}
