import { SUBJECT_TOKEN_TYPES } from "@auth0/ai";
import { Auth0AI, setGlobalAIContext } from "@auth0/ai-vercel";
import {
  AccessDeniedInterrupt,
  type AuthorizationPendingInterrupt,
  type AuthorizationPollingInterrupt,
} from "@auth0/ai/interrupts";
import { getCurrentAgent } from "agents";
import type { Chat } from "./chat";

const getAgent = () => {
  const { agent } = getCurrentAgent<Chat>();
  if (!agent) {
    throw new Error("No agent found");
  }
  return agent;
};

setGlobalAIContext(() => ({ threadID: getAgent().name }));

const auth0AI = new Auth0AI({
  auth0: {
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_RESOURCE_SERVER_CLIENT_ID!, // Resource server client ID for token exchange
    clientSecret: process.env.AUTH0_RESOURCE_SERVER_CLIENT_SECRET!, // Resource server client secret
  },
  store: () => {
    return getAgent().auth0AIStore;
  },
});

export const withGoogleCalendar = auth0AI.withTokenForConnection({
  accessToken: async () => {
    try {
      const agent = getAgent();
      const { accessToken } = await agent.getStoredAuthData();
      return accessToken;
    } catch (error) {
      console.error("Error accessing access token:", error);
      return undefined;
    }
  },
  subjectTokenType: SUBJECT_TOKEN_TYPES.SUBJECT_TYPE_ACCESS_TOKEN,
  connection: "google-oauth2",
  scopes: ["https://www.googleapis.com/auth/calendar.freebusy"],
});

export const withAsyncUserConfirmation = auth0AI.withAsyncUserConfirmation({
  userID: async () => {
    // Get the user ID from agent's stored authentication data
    try {
      const agent = getAgent();
      const { userID } = await agent.getStoredAuthData();
      return userID || "unknown";
    } catch (error) {
      console.error("Error accessing user ID:", error);
      return "unknown";
    }
  },
  // onAuthorizationRequest: "block",
  scopes: ["stock:buy"],
  audience: "https://api.mystocks.example",
  onAuthorizationInterrupt: async (
    interrupt: AuthorizationPendingInterrupt | AuthorizationPollingInterrupt,
    context
  ) => {
    // scheduleAsyncUserConfirmationCheck is provided by the AsyncUserConfirmationResumer mixin at runtime
    // but not declared on the Chat type, so cast to any to avoid TypeScript errors.
    await (getAgent() as any).scheduleAsyncUserConfirmationCheck({
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
