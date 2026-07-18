import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function getJSON(key, fallback) {
  const val = await kv.get(key);
  return val === null || val === undefined ? fallback : val;
}

export async function setJSON(key, value) {
  await kv.set(key, value);
  return value;
}
