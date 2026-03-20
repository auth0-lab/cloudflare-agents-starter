import { openai } from "@ai-sdk/openai";
import { CloudflareKVStore } from "@auth0/ai-cloudflare";
import {
  errorSerializer,
  invokeTools,
  withInterruptions,
} from "@auth0/ai-vercel/interrupts";
import { AIChatAgent } from "@cloudflare/ai-chat";
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

import { AsyncUserConfirmationResumer } from "@auth0/ai-cloudflare";
import { AuthAgent, OwnedAgent } from "@auth0/auth0-cloudflare-agents-api";

const model = openai.chat("gpt-4o-2024-11-20");

const SuperAgent = extend(AIChatAgent<Env>)
  .with(AuthAgent)
  .with(OwnedAgent)
  .with(AsyncUserConfirmationResumer)
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
            messages: await convertToModelMessages(this.messages),
            tools: allTools,
          });

          let processed = await processToolCalls({
            messages: this.messages,
            dataStream: writer,
            tools: allTools,
            executions,
          });

          // Check if there are any tool-error parts in processed messages
          for (let msgIdx = 0; msgIdx < processed.length; msgIdx++) {
            const msg = processed[msgIdx];
            if (msg.parts) {
              for (let partIdx = 0; partIdx < msg.parts.length; partIdx++) {
                const part = msg.parts[partIdx];
                if (part.type === "tool-error") {
                  const error = {
                    cause: (part as any).error,
                    toolCallId: (part as any).toolCallId,
                    toolName: (part as any).toolName,
                    toolArgs: (part as any).input,
                  };
                  throw error;
                }
              }
            }
          }

          const result = streamText({
            model,
            stopWhen: stepCountIs(10),
            system: `You are a helpful assistant that can do various tasks...

If the user asks to schedule a task, use the schedule tool to schedule the task.

The name of the user is ${claims?.name ?? "unknown"}.`,
            messages: await convertToModelMessages(processed),
            tools: allTools,
            onStepFinish: (step) => {
              if (step.finishReason === "tool-calls") {
                for (let i = 0; i < step.content.length; i++) {
                  const item = step.content[i];
                  if (item.type === "tool-error") {
                    const serializableError = {
                      cause: item.error,
                      toolCallId: item.toolCallId,
                      toolName: item.toolName,
                      toolArgs: item.input,
                    };
                    throw serializableError;
                  }
                }
              }
            },
            onFinish: (output) => {
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
        { messages: this.messages, tools: allTools }
      ),
      onError: errorSerializer((err) => {
        return "An error occurred.";
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
