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
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { extend } from "flumix";
import { tools } from "./tools";

const model = openai("gpt-4o-2024-11-20");

const SuperAgent = extend(AIChatAgent<Env>)
  // Authenticate requests and connections using
  // JSON Web Token (JWT) Profile for OAuth 2.0 Access Tokens.
  .with(AuthAgent)
  // Every durable object has an owner set during creation.
  // Other uses will be rejected.
  .with(OwnedAgent)
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
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */
  async onChatMessage() {
    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.unstable_getAITools(),
    };

    const stream = createUIMessageStream({
      originalMessages: this.messages,
      execute: withInterruptions(
        async ({ writer }) => {
          const result = streamText({
            model: openai("gpt-4o-mini"),
            system: `You are a helpful assistant that can do various tasks...
              If the user asks to schedule a task, use the schedule tool to schedule the task.
            `,
            messages: convertToModelMessages(this.messages),
            tools: allTools,
            stopWhen: stepCountIs(5),
            onStepFinish: (output) => {
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
            },
          });
          writer.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            })
          );
        },
        {
          messages: this.messages,
          tools: allTools,
        }
      ),
      onError: errorSerializer((err) => {
        console.error("ai-sdk route: stream error", err);
        return "Oops, an error occured!";
      }),
    });

    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }

  async generateTitle(messages: UIMessage[], newText: string): Promise<void> {
    if (messages.length < 2) return;
    if (messages.length > 6) return;
    const { text: title } = await generateText({
      model,
      prompt: `Summarize the following conversation in a short and descriptive title,
      like a chat topic label.

      Do not include quotes or punctuation around the title

      Keep it under 8 words, clear and relevant:

      ${messages
        .map((message) => `- ${message.role}: ${message.content}`)
        .join("\n")}\n
      - assistant: ${newText}
      `,
    });
    await this.ctx.storage.put("title", title);

    await setChatTitle({
      userID: (await this.getOwner())!,
      chatID: this.name,
      title,
      env: this.env,
    });
  }

  get auth0AIStore() {
    return new CloudflareKVStore({ kv: this.env.Session });
  }
}
