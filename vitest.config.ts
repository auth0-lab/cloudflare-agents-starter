import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig({
  resolve: {
    alias: {
      // Stub Node.js built-ins that are used by @openfga/sdk but not needed in tests
      "node:https": path.resolve(__dirname, "./tests/stubs/node-https.js"),
      "node:http": path.resolve(__dirname, "./tests/stubs/node-http.js"),
    },
  },
  environments: {
    ssr: {
      keepProcessEnv: true,
    },
  },
  test: {
    // Set test environment variables for Auth0
    env: {
      AUTH0_DOMAIN: "test.auth0.com",
      AUTH0_CLIENT_ID: "test-client-id",
      AUTH0_CLIENT_SECRET: "test-client-secret",
      AUTH0_SESSION_SECRET: "test-session-secret-32-chars-long!",
      BASE_URL: "http://localhost:3000",
      OPENAI_API_KEY: "test-api-key",
    },
    // https://github.com/cloudflare/workers-sdk/issues/9822
    deps: {
      optimizer: {
        ssr: {
          include: ["ajv", "uuid", "tiny-async-pool"],
        },
      },
    },
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
