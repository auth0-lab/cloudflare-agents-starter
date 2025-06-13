import { tool } from "ai";
import { z } from "zod";
import { withAsyncUserConfirmation as withAsyncAuthorization } from "../auth0-ai";

export const buyStock = withAsyncAuthorization(
  tool({
    description: "Allow the user to buy a stock",
    parameters: z.object({
      ticker: z.string().describe("The stock ticker symbol"),
      quantity: z.number().describe("The number of shares to buy").default(1),
      price: z
        .number()
        .optional()
        .describe(
          "The price at which to buy the stock. Defaults to market price"
        ),
    }),
    execute: async ({ ticker, quantity, price }) => {
      return `Purchased ${quantity} shares of ${ticker} at ${price ?? "market price $25"}`;
    },
  })
);
