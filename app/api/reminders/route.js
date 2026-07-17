import { getJSON, setJSON } from "@/lib/db";

export async function GET() {
  const reminders = await getJSON("reminders", []);
  return Response.json({ reminders });
}

export async function POST(req) {
  const { reminders } = await req.json();
  await setJSON("reminders", reminders || []);
  return Response.json({ ok: true });
}
