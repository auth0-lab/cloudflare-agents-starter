import { setChatTitle } from "@/chats";
import { openai } from "@ai-sdk/openai";
import {
  AsyncUserConfirmationResumer,
  CloudflareKVStore,
} from "@auth0/ai-cloudflare";
import {
  errorSerializer,
  withInterruptions,
} from "@auth0/ai-vercel/interrupts";
import { AuthAgent, OwnedAgent } from "@auth0/auth0-cloudflare-agents-api";
import type { Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { getSchedulePrompt } from "agents/schedule";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  streamText,
  type StreamTextOnFinishCallback,
  type ToolSet,
} from "ai";
import { extend } from "flumix";
import { executions, tools } from "./tools";
import { cleanupMessages, processToolCalls } from "./utils";

const model = openai("gpt-4o-2024-11-20");

// Type-compatible wrapper for AuthAgent that works with the new agents framework
const AuthAgentCompat = (Base: any) => {
  // @ts-ignore - Force compatibility between old and new agent frameworks
  return AuthAgent(Base);
};

// Type-compatible wrapper for OwnedAgent that works with the new agents framework
const OwnedAgentCompat = (Base: any) => {
  // @ts-ignore - Force compatibility between old and new agent frameworks
  return OwnedAgent(Base);
};

const SuperAgent = extend(AIChatAgent<Env>)
  // Authenticate requests and connections using
  // JSON Web Token (JWT) Profile for OAuth 2.0 Access Tokens.
  // .with(AuthAgentCompat)
  // // Every durable object has an owner set during creation.
  // // Other uses will be rejected.
  // .with(OwnedAgentCompat)
  // Take advantage of Agent scheduling capabilities
  // to handle async user confirmation polling.
  .with(AsyncUserConfirmationResumer)
  // Builds the agent with all mixins applied.
  .build();

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends SuperAgent {
  /**
   * Stores authentication data from request headers in durable storage
   * This is called by the agent middleware to cache auth data for use by Auth0 AI
   */
  async storeAuthData(accessToken?: string, userID?: string) {
    if (accessToken) {
      await (this as any).ctx.storage.put("auth:accessToken", accessToken);
    }
    if (userID) {
      await (this as any).ctx.storage.put("auth:userID", userID);
    }
  }

  /**
   * Extracts authentication data from current request headers and stores it
   * This method attempts to access headers through the agent's context if available
   */
  async extractAndStoreAuthData() {
    try {
      // Try to extract auth data from request context
      // Note: This is a workaround since direct header access isn't available
      // We'll need to rely on the middleware setting these in storage or
      // find another mechanism to pass this data

      // For now, we'll check if auth data is already stored
      // and only update if we have new information
      const existingData = await this.getStoredAuthData();

      // If we already have auth data, we don't need to extract again
      if (existingData.accessToken && existingData.userID) {
        return;
      }

      // TODO: Implement proper header extraction when agent framework provides access
      // For now, this method serves as a placeholder for future implementation
    } catch (error) {
      console.error("Error extracting auth data:", error);
    }
  }

  /**
   * Retrieves stored authentication data from durable storage
   */
  async getStoredAuthData() {
    const accessToken = (await (this as any).ctx.storage.get(
      "auth:accessToken"
    )) as string | undefined;
    const userID = (await (this as any).ctx.storage.get("auth:userID")) as
      | string
      | undefined;
    return { accessToken, userID };
  }

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Ensure we have the latest authentication data
    await this.extractAndStoreAuthData();

    // Collect all tools
    const allTools = {
      ...tools,
      // ...this.mcp.getAITools() // MCP tools if needed
    };

    // Clean up incomplete tool calls to prevent API errors
    const cleanedMessages = cleanupMessages((this as any).messages);

    const stream = createUIMessageStream({
      originalMessages: cleanedMessages,
      execute: withInterruptions(
        async ({ writer }) => {
          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          const processedMessages = await processToolCalls({
            messages: cleanedMessages,
            dataStream: writer,
            tools: allTools,
            executions,
          });

          const result = streamText({
            system: `You are a helpful assistant that can do various tasks...

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.

The name of the user is unknown.
`,
            messages: convertToModelMessages(processedMessages),
            model,
            tools: allTools,
            onFinish: (output) => {
              // Handle tool errors like in the Auth0 AI example
              if (output.finishReason === "tool-calls") {
                const lastMessage = output.content[output.content.length - 1];
                if (lastMessage?.type === "tool-error") {
                  const { toolName, toolCallId, error, input } = lastMessage;
                  const serializableError = {
                    cause: error,
                    toolCallId: toolCallId,
                    toolName: toolName,
                    toolArgs: input,
                  };
                  throw serializableError;
                }
              }

              // Call the original onFinish callback
              onFinish(output as any);
            },
          });

          writer.merge(result.toUIMessageStream());
        },
        {
          messages: cleanedMessages,
          tools: allTools,
        }
      ),
      onError: errorSerializer((error) => {
        console.error("Error in chat stream:", error);
        return "Oops! An error occurred.";
      }),
    });

    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string, task: Schedule<string>) {
    await (this as any).saveMessages([
      ...(this as any).messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      } as any,
    ]);
  }

  async generateTitle(messages: any[], newText: string): Promise<void> {
    if (messages.length < 2) return;
    if (messages.length > 6) return;

    const { text: title } = await generateText({
      model,
      prompt: `Summarize the following conversation in a short and descriptive title,
      like a chat topic label.

      Do not include quotes or punctuation around the title

      Keep it under 8 words, clear and relevant:

      ${messages
        .map(
          (message) =>
            `- ${message.role}: ${message.content || JSON.stringify(message)}`
        )
        .join("\n")}\n
      - assistant: ${newText}
      `,
    });

    await (this as any).ctx.storage.put("title", title);

    // Get the stored userID from auth data
    const { userID } = await this.getStoredAuthData();

    await setChatTitle({
      userID: userID || "unknown", // Use stored userID or fallback
      chatID: (this as any).name,
      title,
      env: (this as any).env,
    });
  }

  /**
   * Override the fetch method to extract authentication data from headers
   * This method is called when the agent receives any request
   */
  async fetch(request: Request): Promise<Response> {
    // Extract authentication data from headers
    const accessToken = request.headers
      .get("Authorization")
      ?.replace("Bearer ", "");
    const userID = request.headers.get("x-user-id");

    // Store the authentication data if available
    if (accessToken || userID) {
      await this.storeAuthData(accessToken || undefined, userID || undefined);
    }

    // Call the parent fetch method to handle the actual request
    return super.fetch(request);
  }

  get auth0AIStore() {
    return new CloudflareKVStore({ kv: (this as any).env.Session });
  }
}
