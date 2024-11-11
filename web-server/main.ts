import { Application, Router } from "jsr:@oak/oak";
import { Context } from "jsr:@oak/oak/context";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { transparentPixelPNG } from "./pixel.ts";
import { EmailData } from "./types.ts";


// setup
const kv = await Deno.openKv();
const whitelistEnv = Deno.env.get("WHITELIST_EMAILS");
if (whitelistEnv) {
  const whitelistedEmails = whitelistEnv.split(',').map(email => email.trim()).filter(email => email.length > 0);
  if (whitelistedEmails.length > 0) {
    await kv.set(["whitelist_emails"], whitelistedEmails);
    console.log("Whitelist emails set:", whitelistedEmails);
  } else {
    console.error("WHITELIST_EMAILS must contain at least one valid email");
  }
} else {
  console.warn("WHITELIST_EMAILS not set in environment");
}

async function authorizationMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const authHeader = ctx.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ctx.response.status = 401;
    ctx.response.body = { error: 'Unauthorized: No token provided' };
    return;
  }

  const accessToken = authHeader.substring('Bearer '.length);

  try {
    const userInfo = await getUserInfo(accessToken);
    const email = userInfo.email;
    if (!email) {
      ctx.response.status = 401;
      ctx.response.body = { error: 'Unauthorized: No email in token' };
      return;
    }

    console.log(userInfo);

    // Check if email is whitelisted
    if (!(await isEmailWhitelisted(email))) {
      ctx.response.status = 403;
      ctx.response.body = { error: 'Forbidden: Email not authorized' };
      return;
    }

    ctx.state.email = email;

    await next();
  } catch (error) {
    console.error('Token validation failed:', error);
    ctx.response.status = 401;
    ctx.response.body = { error: 'Unauthorized: Token validation failed' };
  }
}

// Function to get user info from access token
async function getUserInfo(accessToken: string): Promise<{ email: string }> {
  const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Userinfo endpoint returned status ${response.status}`);
  }

  const userInfo = await response.json();

  if (!userInfo.email) {
    throw new Error('Email not found in user info');
  }

  return userInfo;
}

// Whitelist management functions
async function isEmailWhitelisted(email: string): Promise<boolean> {
  const result = await kv.get(["whitelist_emails"]);
  if (!result.value) {
    console.error("Whitelist not found in KV store");
    return false;
  }
  const whitelistedEmails = result.value as string[];
  console.log("whitelistedEmails: ", whitelistedEmails);
  console.log("email: ", email);
  return whitelistedEmails.includes(email);
}

const returnImage = (ctx: Context) => {
  ctx.response.headers.set("Content-Type", "image/png");
  ctx.response.body = transparentPixelPNG;
};

const router = new Router();
router.get("/:uuid/pixel.png", async (ctx) => {
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

router.post("/:uuid/pixel.png", authorizationMiddleware, async (ctx) => {
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
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8080 });
