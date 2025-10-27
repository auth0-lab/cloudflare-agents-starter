import { Auth0AI, setGlobalAIContext } from "@auth0/ai-vercel";
import {
  AccessDeniedInterrupt,
  type AuthorizationPendingInterrupt,
  type AuthorizationPollingInterrupt,
} from "@auth0/ai/interrupts";
import { getCurrentAgent } from "agents";
import type { ChatInstance } from "./chat";

const getAgent = () => {
  const { agent } = getCurrentAgent<ChatInstance>();
  if (!agent) {
    throw new Error("No agent found");
  }
  return agent;
};

setGlobalAIContext(() => ({ threadID: getAgent().name }));

const auth0AI = new Auth0AI({
  store: () => {
    return getAgent().auth0AIStore;
  },
});

export const withGoogleCalendar = auth0AI.withTokenVault({
  refreshToken: async () => {
    const credentials = getAgent().getCredentials();
    return credentials?.refresh_token;
  },
  connection: "google-oauth2",
  scopes: ["https://www.googleapis.com/auth/calendar.freebusy"],
});

export const withAsyncAuthorization = auth0AI.withAsyncAuthorization({
  userID: async () => {
    const owner = await getAgent().getOwner();
    if (!owner) {
      throw new Error("No owner found");
    }
    return owner;
  },
  onAuthorizationRequest: async (creds) => {
    console.log(
      `An authorization request was sent to your mobile device or your email.`
    );
    await creds;
    console.log(`Thanks for approving the order.`);
  },
  scopes: ["stock:trade"],
  audience: process.env.AUDIENCE!,
  onAuthorizationInterrupt: async (
    interrupt: AuthorizationPendingInterrupt | AuthorizationPollingInterrupt,
    context
  ) => {
    await getAgent().scheduleAsyncUserConfirmationCheck({
      interrupt,
      context,
    });
  },
  onUnauthorized: async (e: Error) => {
    if (e instanceof AccessDeniedInterrupt) {
      return "The user has denied the request";
    }
    return e.message;
  },
  bindingMessage: "Please confirm the operation.",
});
