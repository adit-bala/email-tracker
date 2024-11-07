import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import { transparentPixelPNG } from "./pixel.ts";

const kv = await Deno.openKv();

// TODO: handle edge cases

const router = new Router();
router.get("/", (ctx) => {
  ctx.response.body = "Hello world";
}).get("/:uuid/pixel.png", async (ctx) => {
  const email_path_key = ctx.request.url.pathname;
  const data = await kv.get(["emailData", email_path_key]);
  console.log(data);
  ctx.response.headers.set("Content-Type", "image/png");
  ctx.response.body = transparentPixelPNG;
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
