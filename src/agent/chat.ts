import { openai } from "@ai-sdk/openai";
import {
  AsyncUserConfirmationResumer,
  CloudflareKVStore,
} from "@auth0/ai-cloudflare";
import {
  errorSerializer,
  invokeTools,
  withInterruptions,
} from "@auth0/ai-vercel/interrupts";
import { AuthAgent, OwnedAgent } from "@auth0/auth0-cloudflare-agents-api";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
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

export class Chat extends SuperAgent {
  messages: UIMessage[] = [];

  async onChatMessage() {
    const allTools = {
      ...tools,
      ...(this.mcp?.getAITools?.() ?? {}),
    };

    const claims = this.getClaims?.();

    const stream = createUIMessageStream({
      originalMessages: this.messages,
      execute: withInterruptions(
        async ({ writer }) => {
          await invokeTools({
            messages: convertToModelMessages(this.messages),
            tools: allTools,
          });

          const processed = await processToolCalls({
            messages: this.messages,
            dataStream: writer,
            tools: allTools,
            executions,
          });

          const result = streamText({
            model,
            stopWhen: stepCountIs(10),
            messages: convertToModelMessages(processed),
            system: `You are a helpful assistant that can do various tasks...

If the user asks to schedule a task, use the schedule tool to schedule the task.

The name of the user is ${claims?.name ?? "unknown"}.`,
            tools: allTools,
            onStepFinish: (output) => {
              if (output.finishReason === "tool-calls") {
                const last = output.content[output.content.length - 1];
                if (last?.type === "tool-error") {
                  const { toolName, toolCallId, error, input } = last;
                  const serializableError = {
                    cause: error,
                    toolCallId,
                    toolName,
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
        { messages: this.messages, tools: allTools }
      ),
      onError: errorSerializer(),
    });

    return createUIMessageStreamResponse({ stream });
  }

  async executeTask(description: string) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          { type: "text", text: `Running scheduled task: ${description}` },
        ],
      },
    ]);
  }

  get auth0AIStore() {
    return new CloudflareKVStore({ kv: this.env.Session });
  }
}
