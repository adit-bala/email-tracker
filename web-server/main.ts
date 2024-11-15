import { Application, Router } from "jsr:@oak/oak";
import { Context } from "jsr:@oak/oak/context";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { EmailData, UserData } from "./utils/types.ts";
import { 
  extractNamesAndEmails, 
  getUserData, 
  updateUserData, 
  formatDate, 
  calculateTimeToOpen,
  returnImage,
  listAllKeysAndValues
} from "@utils";
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

// View all Keys
//console.log("All keys: ", await listAllKeysAndValues(kv));

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
    const emailPathKey = ctx.request.url.pathname;
    const res = await kv.get(["emailData", emailPathKey]);
    if (!res.value) {
      ctx.response.status = 404;
      return;
    }

    const data = res.value as EmailData;
    if (!data.email_id || !data.recipient || !data.sender || !data.dateAtTimeOfSend) {
      ctx.response.status = 404;
      return;
    }

    const emailKey = ["emailData", emailPathKey];
    const getResult = await kv.get(emailKey);
    if (!getResult.value) {
      ctx.response.status = 404;
      return;
    }

    const emailData = getResult.value as EmailData;
    emailData.numberOfOpens = (emailData.numberOfOpens || 0) + 1;

    const commitResult = await kv.atomic()
      .check({ key: emailKey, versionstamp: getResult.versionstamp }) // Ensure that another thread didn't update the data in the meantime
      .set(emailKey, emailData)
      .commit();

    console.log("emailData: ", emailData);

    if (!commitResult.ok) {
      returnImage(ctx);
      // ctx.response.status = 500;
      // ctx.response.body = { error: "Failed to update email data" };
      return;
    }

    const numberOfOpens = emailData.numberOfOpens;

    // Decide whether to send a notification
    const sendNotificationOpens = [1, 2, 3, 10, 50, 100];

    if (sendNotificationOpens.includes(numberOfOpens)) {
      // Extract sender email
      const [{ email: senderEmail }] = extractNamesAndEmails(emailData.sender);
      console.log("senderEmail: ", senderEmail);

      // Get or initialize user data
      const userData = await getUserData(senderEmail, kv);

      // Check rate limit
      if (userData.emailsSentThisMonth >= 500) {
        // ctx.response.status = 429; // Too Many Requests
        // ctx.response.body = { error: "Monthly email limit reached" };
        returnImage(ctx);
        return;
      }

      // Prepare email content
      const userIndex = emailData.userIndex || 0;
      const emailLink = `https://mail.google.com/mail/u/${userIndex}/#inbox/${emailData.email_id}`;
      const emailSubject = `Your email: ${emailData.subject} was opened!`;
      const [{ name: recipientName, email: recipientEmail }] = extractNamesAndEmails(emailData.recipient);
      const emailFrom = `Email-Tracker <no-reply@${Deno.env.get("EMAIL_TRACKER_DOMAIN")}>`;

      const replacements = {
        '{{recipient_name}}': recipientName,
        '{{recipient_email}}': recipientEmail,
        '{{email_subject}}': emailData.subject,
        '{{sender_email}}': senderEmail,
        '{{sent_date}}': formatDate(emailData.dateAtTimeOfSend),
        '{{time_to_open}}': calculateTimeToOpen(emailData.dateAtTimeOfSend),
        '{{read_date}}': formatDate(Date.now().toString()),
        '{{email_link}}': emailLink,
      };

      const emailHtml = Object.entries(replacements).reduce(
        (html, [placeholder, value]) => html.replaceAll(placeholder, value),
        htmlTemplate
      );

      // Send email notification using Resend API
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [senderEmail],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to send email notification: ${res.statusText}`);
        }

        // Update user data after successful send
        userData.emailsSentThisMonth += 1;
        await updateUserData(userData, kv);
      } catch (error) {
        // Log the error and proceed
        console.error("Failed to send email notification:", error);
      }
    }

    // Return the tracking pixel image
    returnImage(ctx);
  } catch (error) {
    // Handle unexpected errors
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

Deno.cron("Reset user email counts", "0 0 1 * *", async () => {
  console.log("Starting monthly reset of user email counts");

  const iterator = kv.list({ prefix: ["users"] });

  try {
    for await (const entry of iterator) {
      const userData = entry.value as UserData;
      userData.emailsSentThisMonth = 0;
      userData.lastReset = Date.now();
      await kv.set(entry.key, userData);
      console.log(`Reset email count for user ${userData.email}`);
    }
    console.log("Monthly reset of user email counts completed");
  } catch (error) {
    console.error("Error during monthly reset of user email counts:", error);
  }
});
