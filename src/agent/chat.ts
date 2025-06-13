import { setChatTitle } from "@/chats";
import { openai } from "@ai-sdk/openai";
import {
  AsyncUserConfirmationResumer,
  CloudflareKVStore,
} from "@auth0/ai-cloudflare";
import { errorSerializer, invokeTools } from "@auth0/ai-vercel/interrupts";
import { Auth0Interrupt } from "@auth0/ai/interrupts";
import { AuthAgent, OwnedAgent } from "@auth0/auth0-cloudflare-agents-api";
import { type Schedule } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import { unstable_getSchedulePrompt } from "agents/schedule";
import {
  createDataStreamResponse,
  generateId,
  generateText,
  streamText,
  type Message,
  type StreamTextOnFinishCallback,
  type ToolSet,
} from "ai";
import { extend } from "flumix";
import { executions, tools } from "./tools";
import { processToolCalls } from "./utils";

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
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal }
  ) {
    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.unstable_getAITools(),
    };
    const claims = this.getClaims();
    // Create a streaming response that handles both text and tool outputs
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        // Invoke Auth0 interrupted tools
        await invokeTools({
          messages: this.messages,
          tools: allTools,
        });

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: this.messages,
          dataStream,
          tools: allTools,
          executions,
        });

        // Stream the AI response using GPT-4
        const result = streamText({
          model,
          system: `You are a helpful assistant that can do various tasks...

${unstable_getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.

The name of the user is ${claims?.name ?? "unknown"}.
`,
          messages: processedMessages,
          tools: allTools,
          onFinish: async (args) => {
            await this.generateTitle(this.messages, args.text);

            onFinish(
              args as Parameters<StreamTextOnFinishCallback<ToolSet>>[0]
            );
            // await this.mcp.closeConnection(mcpConnection.id);
          },
          onError: (error) => {
            if (!Auth0Interrupt.isInterrupt(error)) {
              return;
            }
            console.error("Error while streaming:", error);
          },
          maxSteps: 10,
        });

        // Merge the AI response stream with tool execution outputs
        result.mergeIntoDataStream(dataStream);
      },
      onError: errorSerializer(),
    });

    return dataStreamResponse;
  }

  async executeTask(description: string, task: Schedule<string>) {
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

  async generateTitle(messages: Message[], newText: string): Promise<void> {
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
