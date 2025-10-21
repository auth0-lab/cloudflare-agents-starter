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
  // onAuthorizationRequest: "block",
  scopes: ["stock:buy"],
  audience: "https://api.mystocks.example",
  onAuthorizationInterrupt: async (
    interrupt: AuthorizationPendingInterrupt | AuthorizationPollingInterrupt,
    context
  ) => {
    await getAgent().scheduleAsyncUserConfirmationCheck({ interrupt, context });
  },
  onUnauthorized: async (e: Error) => {
    if (e instanceof AccessDeniedInterrupt) {
      return "The user has denied the request";
    }
    return e.message;
  },
  bindingMessage: "Please confirm the operation.",
});
