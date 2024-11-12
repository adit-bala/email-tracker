import { Application, Router } from "jsr:@oak/oak";
import { Context } from "jsr:@oak/oak/context";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import Mailgun from "https://deno.land/x/mailgun@v1.3.0/index.ts";
import { transparentPixelPNG } from "./utils/pixel.ts";
import { EmailData } from "./utils/types.ts";
import { extractNameAndEmail, formatDate, calculateTimeToOpen } from "./utils/utils.ts";
import { htmlTemplate } from "./emailTemplate.ts";

// Setup

// KV store
let kv: Deno.Kv;
try {
  kv = await Deno.openKv();
} catch (error) {
  console.error("Failed to open KV store:", error);
  Deno.exit(1);
}

// Whitelist emails
const whitelistEnv = Deno.env.get("WHITELIST_EMAILS");
if (whitelistEnv) {
  try {
    const whitelistedEmails = whitelistEnv
      .replace(/^"|"$/g, "")
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (whitelistedEmails.length > 0) {
      await kv.set(["whitelist_emails"], whitelistedEmails);
      console.log("Whitelist emails set:", whitelistedEmails);
    } else {
      throw new Error("WHITELIST_EMAILS must contain at least one valid email");
    }
  } catch (error) {
    console.error("Error setting whitelist emails:", error);
  }
} else {
  console.warn("WHITELIST_EMAILS not set in environment");
}

// email API
const mailgun = new Mailgun({
  key: Deno.env.get("EMAIL_API_KEY")!,
  region: "us", // or "eu" depending on your Mailgun region
  domain: Deno.env.get("DOMAIN")!,
});

async function authorizationMiddleware(
  ctx: Context,
  next: () => Promise<unknown>,
) {
  try {
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Unauthorized: No token provided" };
      return;
    }

    const accessToken = authHeader.substring("Bearer ".length);
    const userInfo = await getUserInfo(accessToken);
    const email = userInfo.email;
    if (!email) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Unauthorized: No email in token" };
      return;
    }

    if (!(await isEmailWhitelisted(email))) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Forbidden: Email not authorized" };
      return;
    }

    ctx.state.email = email;
    await next();
  } catch (error) {
    console.error("Authorization error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error during authorization" };
  }
}

// Function to get user info from access token
async function getUserInfo(accessToken: string): Promise<{ email: string }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Userinfo endpoint returned status ${response.status}`);
    }

    const userInfo = await response.json();

    if (!userInfo.email) {
      throw new Error("Email not found in user info");
    }

    return userInfo;
  } catch (error) {
    console.error("Error fetching user info:", error);
    throw error;
  }
}

// Whitelist management functions
async function isEmailWhitelisted(email: string): Promise<boolean> {
  try {
    const result = await kv.get(["whitelist_emails"]);
    if (!result.value) {
      console.error("Whitelist not found in KV store");
      return false;
    }
    const whitelistedEmails = result.value as string[];
    return whitelistedEmails.includes(email);
  } catch (error) {
    console.error("Error checking whitelist:", error);
    return false;
  }
}

const router = new Router();
router.get("/:uuid/pixel.png", async (ctx) => {
  try {
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
      !data.email_id || !data.recipient ||
      !data.sender || !data.dateAtTimeOfSend
    ) {
      ctx.response.status = 404;
      return;
    }
    // Update state
    data.numberOfOpens = (data.numberOfOpens || 0) + 1;
    await kv.set(["emailData", email_path_key], data);

    // Send email opened notification
    const emailLink =
      `https://mail.google.com/mail/u/0/#inbox/${data.email_id}`;
    console.log(
      "Email Opened!: ",
      emailLink,
      " Number of opens: ",
      data.numberOfOpens,
    );

    // Send email opened notification
    const emailSubject = `Your email: ${data.subject} was opened!`;
    const { name: recipientName, email: recipientEmail } = extractNameAndEmail(data.recipient);
    const { name: senderName, email: senderEmail } = extractNameAndEmail(data.sender);
    const emailFrom = `no-reply@${Deno.env.get("DOMAIN")}`;
    const emailHtml = htmlTemplate
      .replace('{{recipient_name}}', recipientName)
      .replace('{{recipient_email}}', recipientEmail)
      .replace('{{email_subject}}', data.subject)
      .replace('{{sender_email}}', senderEmail)
      .replace('{{sent_date}}', formatDate(data.dateAtTimeOfSend))
      .replace('{{time_to_open}}', calculateTimeToOpen(data.dateAtTimeOfSend))
      .replace('{{read_date}}', formatDate(Date.now().toString()))
      .replace('{{email_link}}', `https://mail.google.com/mail/u/0/#inbox/${data.email_id}`)
      .replace('{{current_year}}', new Date().getFullYear().toString());
    console.log("Email HTML: ", emailHtml);
    await mailgun.send({
      from: emailFrom,
      to: senderEmail,
      subject: emailSubject,
      html: emailHtml,
    });
    console.log(`Email notification sent successfully to ${senderEmail}`);

    ctx.response.headers.set("Content-Type", "image/png");
    ctx.response.body = transparentPixelPNG;
  } catch (error) {
    console.error("Error processing pixel request:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

router.post("/:uuid/pixel.png", authorizationMiddleware, async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const email_path_key = ctx.request.url.pathname;
    const timestamp = Date.now();
    const emailData: EmailData = {
      ...body,
      numberOfOpens: 0,
      storedAt: timestamp,
    };
    console.log("email_key: ", email_path_key);
    console.log("body: ", body);
    await kv.set(["emailData", email_path_key], emailData);
    ctx.response.status = 200;
    ctx.response.body = { message: "Email data stored successfully" };
  } catch (error) {
    console.error("Error processing email data:", error);
    ctx.response.status = 400;
    ctx.response.body = { error: "Error processing request" };
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

app.addEventListener("error", (evt) => {
  console.error("Unhandled application error:", evt.error);
});

try {
  await app.listen({ port: 8080 });
} catch (error) {
  console.error("Failed to start server:", error);
}

Deno.cron("Delete old email data", "0 0 * * *", async () => {
  console.log("Starting daily cleanup of old email data");
  const sixtyDaysInMs = 60 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const iterator = kv.list({ prefix: ["emailData"] });

  try {
    for await (const entry of iterator) {
      const emailData = entry.value as EmailData;
      const storedAt = emailData.storedAt;

      if (storedAt) {
        const age = now - storedAt;
        if (age > sixtyDaysInMs) {
          try {
            await kv.delete(entry.key);
            console.log(
              `Deleted email data at key ${entry.key} (age: ${age} ms)`,
            );
          } catch (error) {
            console.error(`Error deleting entry at key ${entry.key}:`, error);
          }
        }
      } else {
        console.warn(
          `No timestamp for entry at key ${entry.key}. Deleting as precaution.`,
        );
        try {
          await kv.delete(entry.key);
        } catch (error) {
          console.error(
            `Error deleting entry without timestamp at key ${entry.key}:`,
            error,
          );
        }
      }
    }
    console.log("Daily cleanup of old email data completed");
  } catch (error) {
    console.error("Error during daily cleanup of old email data:", error);
  }
});
