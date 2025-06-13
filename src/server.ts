import { auth, requiresAuth, type OIDCVariables } from "@auth0/auth0-hono";
import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { logger } from "hono/logger";
import { createNewChat, listChats } from "./chats";

export { Chat } from "./agent";

export type HonoEnv = {
  Bindings: Env;
  Variables: OIDCVariables;
};

const app = new Hono<HonoEnv>();

app.use(logger());

app.use(
  auth({
    authRequired: false,
    idpLogout: true,
    forwardAuthorizationParams: [
      "scope",
      "access_type",
      "prompt",
      "connection",
      "connection_scope",
    ],
  })
);

app.get("/user", async (c): Promise<Response> => {
  // const session = c.get("session");
  const session = await c.var.auth0Client?.getSession(c);
  if (!session?.user) {
    return c.json({ error: "User not authenticated" }, 401);
  }
  return c.json(session.user);
});

app.get("/check-open-ai-key", async (c) => {
  return c.json({
    success: process.env.OPENAI_API_KEY !== undefined,
  });
});

app.get("/close", async (c) => {
  return c.html(`
    <html>
      <head>
        <title>Close</title>
        <script>
          window.close();
        </script>
      </head>
      <body>
        <h1>You can now close this window.</h1>
      </body>
    </html>
  `);
});

app.post("/api/chats", requiresAuth(), async (c) => {
  const session = await c.var.auth0Client?.getSession(c);
  if (!session?.user) {
    return c.json({ error: "User not authenticated" }, 401);
  }
  const id = await createNewChat({
    userID: session.user.sub,
    env: c.env,
  });
  return c.json({ id });
});

app.get("/api/chats", requiresAuth(), async (c) => {
  const session = await c.var.auth0Client?.getSession(c);
  if (!session?.user) {
    return c.json({ error: "User not authenticated" }, 401);
  }
  const chats = await listChats({
    userID: session.user.sub,
    env: c.env,
  });
  return c.json(chats);
});

app.get("/c/new", requiresAuth(), async (c) => {
  const session = await c.var.auth0Client?.getSession(c);
  if (!session?.user) {
    return c.json({ error: "User not authenticated" }, 401);
  }
  const id = await createNewChat({
    userID: session.user.sub,
    env: c.env,
  });
  return c.redirect(`/c/${id}`);
});

app.get("/c/:chadID", requiresAuth(), async (c) => {
  const res = await c.env.ASSETS.fetch(new URL("/", c.req.url));
  return new Response(res.body, res);
});

app.use("/agents/*", requiresAuth("error"), async (c, next) => {
  const session = await c.var.auth0Client?.getSession(c);
  const tokenSet = await c.var.auth0Client?.getAccessToken(c);
  const addToken = (req: Request) => {
    const accessToken = tokenSet?.accessToken;
    if (accessToken) {
      req.headers.set("Authorization", `Bearer ${accessToken}`);
    }
    //NOTE: this is only needed for Federated Connection Token Vault
    // the tool that answer "am I available next monday 9am?"
    if (session?.refreshToken) {
      req.headers.set("x-refresh-token", session?.refreshToken);
    }
    return req;
  };
  return agentsMiddleware({
    options: {
      prefix: `agents`,
      async onBeforeRequest(req) {
        return addToken(req);
      },
      async onBeforeConnect(req, lobby) {
        return addToken(req);
      },
    },
    // @ts-ignore
  })(c, next);
});

app.use("*", async (c, next) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  return new Response(res.body, res);
});

export default app;
