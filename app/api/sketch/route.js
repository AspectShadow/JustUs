import { getJSON, setJSON } from "@/lib/db";

export async function GET() {
  const sketch = await getJSON("sketch", { dataUrl: null, ts: 0 });
  return Response.json({ sketch });
}

export async function POST(req) {
  const { dataUrl } = await req.json();
  const sketch = { dataUrl, ts: Date.now() };
  await setJSON("sketch", sketch);
  return Response.json({ ok: true, ts: sketch.ts });
}
