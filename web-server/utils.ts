import { EmailData } from "./types.ts";

export async function getAllEmailData(kv: Deno.Kv) {
  const entries = [];
  for await (const entry of kv.list({ prefix: ["emailData"] })) {
    entries.push({ key: entry.key, value: entry.value });
  }
  return entries;
}

export async function getEmailDataByUuid(kv: Deno.Kv, uuid: string) {
  const key = ["emailData", `/${uuid}/pixel.png`];
  const result = await kv.get(key);
  return result.value;
}

export async function setEmailData(kv: Deno.Kv, uuid: string, data: EmailData) {
  const key = ["emailData", `/${uuid}/pixel.png`];
  await kv.set(key, data);
}

export async function deleteEmailData(kv: Deno.Kv, uuid: string) {
  const key = ["emailData", `/${uuid}/pixel.png`];
  await kv.delete(key);
}

export async function countEmailData(kv: Deno.Kv) {
  let count = 0;
  for await (const _ of kv.list({ prefix: ["emailData"] })) {
    count++;
  }
  return count;
}

export async function deleteAllEmailData(kv: Deno.Kv) {
  const keysToDelete = [];
  for await (const entry of kv.list({ prefix: ["emailData"] })) {
    keysToDelete.push(entry.key);
  }
  
  let deletedCount = 0;
  for (const key of keysToDelete) {
    await kv.delete(key);
    deletedCount++;
  }
  
  return deletedCount;
}