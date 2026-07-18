import webpush from "web-push";
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(webpush.generateVAPIDKeys());
}
