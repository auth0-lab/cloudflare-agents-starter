import { getAccessTokenFromTokenVault } from "@auth0/ai-vercel";
import { TokenVaultError } from "@auth0/ai/interrupts";
import { tool } from "ai";
import { addHours } from "date-fns";
import { z } from "zod";
import { withGoogleCalendar } from "../auth0-ai";

export const checkUsersCalendar = withGoogleCalendar(
  tool({
    description:
      "Check user availability on a given date time on their calendar",
    inputSchema: z.object({
      date: z.coerce.date(),
    }),
    execute: async ({ date }) => {
      // Get the access token from Auth0 AI
      const accessToken = getAccessTokenFromTokenVault();
      const url = "https://www.googleapis.com/calendar/v3/freeBusy";
      const body = JSON.stringify({
        timeMin: date,
        timeMax: addHours(date, 1),
        timeZone: "UTC",
        items: [{ id: "primary" }],
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new TokenVaultError(
            "Authorization required to access the Federated Connection"
          );
        }
        throw new Error(
          `Invalid response from Google Calendar API: ${
            response.status
          } - ${await response.text()}`
        );
      }

      const busyResp = await response.json();
      // @ts-expect-error return type unknown
      return { available: busyResp.calendars.primary.busy.length === 0 };
    },
  })
);
