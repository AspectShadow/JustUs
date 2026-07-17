import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();

export async function getJSON(key, fallback) {
  const val = await kv.get(key);
  return val === null || val === undefined ? fallback : val;
}

export async function setJSON(key, value) {
  await kv.set(key, value);
  return value;
}
