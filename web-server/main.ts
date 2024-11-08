import { Application, Router } from "jsr:@oak/oak";
import { Context } from "jsr:@oak/oak/context";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { transparentPixelPNG } from "./pixel.ts";
import { EmailData } from "./types.ts";

const authorizationMiddleware = async (_ctx: Context, next: () => Promise<unknown>) => {

  await next();
};

// setup
const kv = await Deno.openKv();

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
    sender: value?.sender,
    recipient: value?.recipient,
    dateAtTimeOfSend: value?.dateAtTimeOfSend,
  };
  if (
    !data.subject || !data.email_id || !data.recipient ||
    !data.sender || !data.dateAtTimeOfSend
  ) {
    ctx.response.status = 404;
    return;
  }
  const emailLink = `https://mail.google.com/mail/u/0/#inbox/${data.email_id}`;
  console.log("Email Opened!: ", emailLink);
  returnImage(ctx);
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

// TODO: only allow from chrome extension in production
app.use(oakCors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

// Apply the checkSecretKey middleware to all routes
app.use(authorizationMiddleware);
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8080 });
