import { Application, Router } from "jsr:@oak/oak";
import { Context } from "jsr:@oak/oak/context";
import { transparentPixelPNG } from "./pixel.ts";
import { EmailData } from "./types.ts";

// setup
const kv = await Deno.openKv();

// TODO: handle edge cases

const returnImage = (ctx: Context) => {
  ctx.response.headers.set("Content-Type", "image/png");
  ctx.response.body = transparentPixelPNG;
};

const router = new Router();
router.get("/", (ctx) => {
  ctx.response.body = "Hello world";
}).get("/:uuid/pixel.png", async (ctx) => {
  const email_path_key = ctx.request.url.pathname;
  const result = await kv.get(["emailData", email_path_key]);
  if (!result.value) {
    ctx.response.status = 404;
    return;
  }
  const value = result.value as Record<string, string>;
  const data: EmailData = {
    subject: value?.subject,
    email_id: value?.email_id,
    sender_email: value?.sender_email,
    dateAtTimeOfSend: value?.dateAtTimeOfSend,
  };
  if (
    !data.subject || !data.sender_email || !data.dateAtTimeOfSend ||
    !data.email_id
  ) {
    ctx.response.status = 404;
    return;
  }
  const emailLink = `https://mail.google.com/mail/u/0/#inbox/${data.email_id}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
    },
    body: JSON.stringify({
      from: `Tracker <noreply@email-tracker.deno.dev>`,
      to: [data.sender_email],
      subject: `Your email "${data.subject}" was opened!`,
      html:
        `<p>Your email was opened! Click <a href="${emailLink}">here</a> to compose a follow-up email.</p>`,
    }),
  });
  if (res.ok) {
    ctx.response.headers.set("Content-Type", "image/png");
    ctx.response.body = transparentPixelPNG;
  } else {
    console.error("Failed to send email notification:", await res.text());
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to send email notification" };
  }
});

router.post("/:uuid/pixel.png", async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const email_path_key = ctx.request.url.pathname;
    console.log("email_key: ", email_path_key);
    console.log("body: ", body);
    await kv.set(["emailData", email_path_key], body);
    ctx.response.status = 200;
  } catch (e) {
    ctx.response.status = 400;
    console.log("Error parsing body: ", e);
  }
});

router;

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8080 });

console.log("Server running on http://localhost:8080");
