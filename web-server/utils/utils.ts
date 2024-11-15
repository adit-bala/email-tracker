import { EmailData, UserData } from "./types.ts";
import { transparentPixelPNG } from "./pixel.ts";
import { Context } from "jsr:@oak/oak/context";

export async function getUserData(
  email: string,
  kv: Deno.Kv,
): Promise<UserData> {
  const userKey = ["users", email.toLowerCase()];
  const result = await kv.get(userKey);

  const now = Date.now();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const startOfMonthTimestamp = startOfMonth.getTime();

  let userData: UserData;

  if (result.value) {
    userData = result.value as UserData;

    if (userData.lastReset < startOfMonthTimestamp) { // If we're in a new month
      userData.emailsSentThisMonth = 0;
      userData.lastReset = now;
    }
  } else {
    // Initialize new user data
    userData = {
      email: email.toLowerCase(),
      emailsSentThisMonth: 0,
      lastReset: now,
    };
  }

  return userData;
}

export async function updateUserData(userData: UserData, kv: Deno.Kv) {
  const userKey = ["users", userData.email];
  await kv.set(userKey, userData);
}

export const extractNamesAndEmails = (
  input: string,
): Array<{ name: string; email: string }> => {
  const regex = /([^<,]+)<([^>]+)>/g;
  const matches = input.matchAll(regex);
  const result: Array<{ name: string; email: string }> = [];

  for (const match of matches) {
    const name = match[1].trim();
    const email = match[2].trim();
    result.push({ name, email });
  }

  return result;
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
    return "less than a minute";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute(s)`;
  } else {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour(s)`;
  }
}

export function returnImage(ctx: Context) {
  ctx.response.headers.set("Content-Type", "image/png");
  ctx.response.body = transparentPixelPNG;
}

// User Data Functions
export async function getAllUserData(kv: Deno.Kv): Promise<UserData[]> {
  const users: UserData[] = [];
  const iterator = kv.list({ prefix: ["users"] });
  for await (const entry of iterator) {
    users.push(entry.value as UserData);
  }
  return users;
}

export async function deleteUserData(
  kv: Deno.Kv,
  email: string,
): Promise<void> {
  const userKey = ["users", email.toLowerCase()];
  await kv.delete(userKey);
}

export async function deleteAllUserData(kv: Deno.Kv): Promise<number> {
  let deletedCount = 0;
  const iterator = kv.list({ prefix: ["users"] });
  for await (const entry of iterator) {
    await kv.delete(entry.key);
    deletedCount++;
  }
  return deletedCount;
}

// General KV Functions
export async function listAllKeys(kv: Deno.Kv): Promise<string[]> {
  const keys: string[] = [];
  const iterator = kv.list({ prefix: [] });
  for await (const entry of iterator) {
    keys.push(entry.key.join("/"));
  }
  return keys;
}

export async function deleteAllKeys(kv: Deno.Kv): Promise<number> {
  let deletedCount = 0;
  const iterator = kv.list({ prefix: [] });
  for await (const entry of iterator) {
    await kv.delete(entry.key);
    deletedCount++;
  }
  return deletedCount;
}

// Prod KV Utility Functions
export async function listAllKeysAndValues(
  kv: Deno.Kv,
): Promise<Array<{ key: string; value: unknown }>> {
  const entries: Array<{ key: string; value: unknown }> = [];
  const iterator = kv.list({ prefix: [] });
  for await (const entry of iterator) {
    entries.push({
      key: entry.key.join("/"),
      value: entry.value,
    });
  }
  return entries;
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
