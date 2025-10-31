import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig({
  resolve: {
    alias: {
      // Stub Node.js built-ins that are used by @openfga/sdk and @slack/web-api but not needed in tests
      "node:https": path.resolve(__dirname, "./tests/stubs/node-https.js"),
      "node:http": path.resolve(__dirname, "./tests/stubs/node-http.js"),
      "node:os": path.resolve(__dirname, "./tests/stubs/node-os.js"),
      "node:path": path.resolve(__dirname, "./tests/stubs/node-path.js"),
      path: path.resolve(__dirname, "./tests/stubs/node-path.js"),
      os: path.resolve(__dirname, "./tests/stubs/node-os.js"),
      // Mock @slack/web-api since it's a CommonJS package that doesn't work in Workers
      "@slack/web-api": path.resolve(__dirname, "./tests/stubs/slack-web-api.js"),
      // Mock fast-content-type-parse since it's a CommonJS package
      "fast-content-type-parse": path.resolve(__dirname, "./tests/stubs/fast-content-type-parse.js"),
      // Mock bottleneck since it's a CommonJS package
      "bottleneck/light.js": path.resolve(__dirname, "./tests/stubs/bottleneck-light.js"),
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
      AUTH0_CLIENT_SECRET: "test-client-secret-must-be-32-chars-long",
      AUTH0_SESSION_SECRET: "test-session-secret-must-be-at-least-32-characters-long",
      AUTH0_SESSION_ENCRYPTION_KEY: "test-session-encryption-key-must-be-32-characters",
      BASE_URL: "http://localhost:3000",
      OPENAI_API_KEY: "test-api-key",
    },
    // https://github.com/cloudflare/workers-sdk/issues/9822
    deps: {
      optimizer: {
        ssr: {
          include: ["ajv", "uuid", "tiny-async-pool"],
          exclude: ["@slack/web-api"],
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
