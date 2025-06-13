# 🤖 Chat Agent Starter Kit with Auth0 Authentication

![agents-header](./public/cloudflare-agents-auth0-sm.png)

A starter template for building AI-powered chat agents using Cloudflare's Agent platform, powered by [`agents`](https://www.npmjs.com/package/agents) and secured with Auth0 authentication. This project provides a foundation for creating interactive chat experiences with AI, complete with a modern UI, tool integration capabilities, and user authentication.

## Features

- 💬 Interactive chat interface with AI
- 🔐 Auth0 authentication and authorization
- 👤 User-specific chat history and management
- 🛠️ Built-in tool system with human-in-the-loop confirmation
- 📅 Advanced task scheduling (one-time, delayed, and recurring via cron)
- 🌓 Dark/Light theme support
- ⚡️ Real-time streaming responses
- 🔄 State management and chat history
- 🎨 Modern, responsive UI

## Prerequisites

- Cloudflare account with Workers & Workers AI enabled
- OpenAI API key
- Auth0 account with a configured:
  - Web Application
  - API (resource server)

## Auth0 Configuration

### Step 1: Create an Auth0 API

1. Log in to your Auth0 dashboard
2. Navigate to "Applications > APIs" and click "Create API"
3. Provide a name and identifier (audience)
4. Note the API Identifier (audience) for later use

### Step 2: Create an Auth0 Application

Note: you can also use the default app.

1. In your Auth0 dashboard, go to "Applications" and click "Create Application"
2. Select "Web Application" as the application type
3. Configure the following settings:
   - Allowed Callback URLs: `http://localhost:3000/callback` (development) and your production URL
   - Allowed Logout URLs: `http://localhost:3000` (development) and your production URL
4. Note your Domain, Client ID, and Client Secret for later use

## Quick Start

1. Create a new Cloudflare Workers project using the Auth0 starter template:

```bash
npx create-cloudflare@latest --template auth0-lab/cloudflare-agents-starter
```

3. Set up your environment:

Create a `.dev.vars` file based on the example:

```env
# OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key

# Auth0 Configuration
# trailing slash in ISSUER is important:
AUTH0_DOMAIN="your-tenant.us.auth0.com/"
AUTH0_CLIENT_ID="your-auth0-client-id"
AUTH0_CLIENT_SECRET="your-auth0-client-secret"
AUTH0_SESSION_ENCRYPTION_KEY="generate-a-random-key-at-least-32-characters-long"
AUTH0_AUDIENCE="https://your-auth0-api-identifier"

# Application base URL
BASE_URL=http://localhost:3000
```

4. Run locally:

```bash
npm start
```

5. Deploy:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── server.ts                # Main worker with auth configuration
│   ├── chats.ts                 # Chat management functions
│   ├── agent/                   # Agent-related code
│   │   ├── index.ts             # Chat agent implementation with Auth0 integration
│   │   ├── tools.ts             # Tool definitions and implementations
│   │   ├── utils.ts             # Agent utility functions
│   │   └── shared.ts            # Shared constants and types
│   ├── client/                  # Frontend client application
│   │   ├── app.tsx              # Chat UI implementation
│   │   ├── home.tsx             # Home page component
│   │   ├── index.tsx            # Entry point for React app
│   │   ├── Layout.tsx           # Layout component
│   │   └── styles.css           # UI styling
│   ├── components/              # UI components
│   │   ├── auth0/               # Auth0-specific components
│   │   ├── chatList/            # Chat list components
│   │   └── ...                  # Other UI components
│   └── hooks/                   # React hooks
│       ├── useUser.tsx          # User authentication hook
│       └── ...                  # Other custom hooks
```

## Authentication Flow

This starter kit uses Auth0 for authentication and authorization:

1. Users log in using Auth0 credentials
2. Auth0 provides JWT tokens for API authentication
3. The Agent use the `WithAuth` mixin from the `agents-oauth2-jwt-bearer` package to validate the JWT token
4. API requests and WebSocket connections are secured with the JWT token
5. Each chat is associated with its owner (user ID) to ensure data isolation

### Authentication Packages

This project utilizes two key npm packages for authentication:

- [`@auth0/auth0-hono`](https://github.com/auth0-lab/auth0-hono) - Handles browser-based authentication flows, session management, and token handling for the web interface.
- [`@auth0/auth0-cloudflare-agents-api`](https://github.com/auth0-lab/auth0-cloudflare-agents-api/) - Secures WebSocket connections and API endpoints for the agent, providing token validation and authorization for all agent interactions.
- [`@auth0/ai`](https://github.com/auth0-lab/auth0-ai-js/) - Provides AI capabilities for the agent. Token Vault for Federated Connections, Backchannel Authorization, and more.

These packages work together to provide a comprehensive authentication solution that secures both the web interface and the underlying agent communication.

## Customization Guide

### Adding New Tools

Add new tools in `src/agent/tools.ts` using the tool builder:

```typescript
// Example of a tool that requires confirmation
const searchDatabase = tool({
  description: "Search the database for user records",
  parameters: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  // No execute function = requires confirmation
});

// Example of an auto-executing tool
const getCurrentTime = tool({
  description: "Get current server time",
  parameters: z.object({}),
  execute: async () => new Date().toISOString(),
});
```

To handle tool confirmations, add execution functions to the `executions` object:

```typescript
export const executions = {
  searchDatabase: async ({
    query,
    limit,
  }: {
    query: string;
    limit?: number;
  }) => {
    // Implementation for when the tool is confirmed
    const results = await db.search(query, limit);
    return results;
  },
  // Add more execution handlers for other tools that require confirmation
};
```

### Extending Auth0 Integration

The integration uses Hono's OpenID Connect middleware for authentication and session management. You can customize the authentication behavior in `src/server.ts`.

The agent uses the `WithAuth` mixin from `agents-oauth2-jwt-bearer` package to secure API endpoints and WebSocket connections. Each chat is associated with its owner through the `setOwner` method to ensure users can only access their own chats.

## Learn More

- [`@auth0/auth0-hono`](https://github.com/auth0-lab/auth0-hono)
- [`@auth0/auth0-cloudflare-agents-api`](https://github.com/auth0-lab/auth0-cloudflare-agents-api/)
- [`@auth0/ai`](https://github.com/auth0-lab/auth0-ai-js/)
- [`agents`](https://github.com/cloudflare/agents/blob/main/packages/agents/README.md)
- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Auth0 Documentation](https://auth0.com/docs/)

## Feedback

### Contributing

We appreciate feedback and contribution to this repo! Before you get started, please see the following:

- [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md)
- [Auth0's code of conduct guidelines](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md)

### Raise an issue

To provide feedback or report a bug, please [raise an issue on our issue tracker](https://github.com/auth0-lab/cloudflare-agents-starter/issues).

### Vulnerability Reporting

Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/responsible-disclosure-policy) details the procedure for disclosing security issues.

---

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png"   width="150">
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_dark_mode.png" width="150">
    <img alt="Auth0 Logo" src="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png" width="150">
  </picture>
</p>
<p align="center">Auth0 is an easy to implement, adaptable authentication and authorization platform. To learn more checkout <a href="https://auth0.com/why-auth0">Why Auth0?</a></p>
<p align="center">
This project is licensed under the Apache 2.0 license. See the <a href="/LICENSE"> LICENSE</a> file for more info.</p>
