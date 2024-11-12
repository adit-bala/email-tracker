import { EmailData } from "./types.ts";

export const extractNameAndEmail = (input: string): { name: string; email: string } => {
  const leftBracketIndex = input.indexOf('<');
  const rightBracketIndex = input.indexOf('>');
  
  const name = input.slice(0, leftBracketIndex).trim();
  const email = input.slice(leftBracketIndex + 1, rightBracketIndex);

  return { name, email };
};

export function formatDate(timestamp: string) {
  const date = new Date(Number(timestamp));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function calculateTimeToOpen(timestamp: string) {
  const now = Date.now();
  const sentTimestamp = Number(timestamp);
  const diffInSeconds = Math.floor((now - sentTimestamp) / 1000);

  if (diffInSeconds < 60) {
    return 'less than a minute';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute(s)`;
  } else {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour(s)`;
  }
}

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
