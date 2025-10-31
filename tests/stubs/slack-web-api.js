// Mock for @slack/web-api package in Cloudflare Workers test environment

export const ErrorCode = {
  HTTPError: "slack_webapi_http_error",
  PlatformError: "slack_webapi_platform_error",
  RequestError: "slack_webapi_request_error",
  RateLimitedError: "slack_webapi_rate_limited_error",
  WebAPICallError: "slack_webapi_call_error",
};

export class WebClient {
  constructor(token, options) {
    this.token = token;
    this.options = options;
  }

  // Mock conversations API
  conversations = {
    list: async (options) => {
      return {
        ok: true,
        channels: [
          { id: "C1234", name: "general" },
          { id: "C5678", name: "random" },
        ],
      };
    },
    info: async (options) => {
      return {
        ok: true,
        channel: {
          id: options.channel,
          name: "test-channel",
        },
      };
    },
  };

  // Mock users API
  users = {
    info: async (options) => {
      return {
        ok: true,
        user: {
          id: options.user,
          name: "testuser",
        },
      };
    },
  };

  // Mock chat API
  chat = {
    postMessage: async (options) => {
      return {
        ok: true,
        ts: "1234567890.123456",
        channel: options.channel,
      };
    },
  };
}

export default {
  WebClient,
  ErrorCode,
};
