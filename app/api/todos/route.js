import { getJSON, setJSON } from "@/lib/db";

export async function GET() {
  const todos = await getJSON("todos", []);
  return Response.json({ todos });
}

export async function POST(req) {
  const { todos } = await req.json();
  await setJSON("todos", todos || []);
  return Response.json({ ok: true });
}
