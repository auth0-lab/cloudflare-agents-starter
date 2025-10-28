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
import type {
  AuthorizationPendingInterrupt,
  AuthorizationPollingInterrupt,
} from "@auth0/ai/interrupts";
import {
  AuthAgent,
  OwnedAgent,
  type Token,
} from "@auth0/auth0-cloudflare-agents-api";
import type { Connection } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import type { Schedule } from "agents/schedule";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { executions, tools } from "./tools";
import { processToolCalls } from "./utils";

const model = openai("gpt-4o-2024-11-20");

// Define mixin method signatures using exported types where available
// These match the signatures from AuthAgent and OwnedAgent mixins
// Note: TokenSet is not exported from the package, so we use a local interface
interface TokenSet {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  [key: string]: any;
}

type MixinMethods = {
  // From AuthAgent mixin
  getClaims(): Token | undefined;
  getCredentials(): TokenSet | undefined;
  getCredentialsFromConnection(connection: Connection): TokenSet | undefined;
  requireAuth(opts?: { scopes?: string[] }): Promise<TokenSet>;

  // From OwnedAgent mixin
  setOwner(owner: string, overwrite?: boolean): Promise<void>;
  getOwner(): Promise<string | undefined>;

  // From AsyncUserConfirmationResumer mixin
  scheduleAsyncUserConfirmationCheck(
    params: {
      interrupt: AuthorizationPendingInterrupt | AuthorizationPollingInterrupt;
      context: {
        threadID: string;
        toolCallID: string;
        toolName: string;
      };
    },
    delayInSeconds?: number
  ): Promise<Schedule>;
  asyncUserConfirmationCheck(params: {
    interrupt: AuthorizationPendingInterrupt | AuthorizationPollingInterrupt;
    context: {
      threadID: string;
      toolCallID: string;
      toolName: string;
    };
  }): Promise<void>;
};

// Apply mixins to a base class that extends AIChatAgent
// Declare that BaseChat has mixin methods for TypeScript type checking
class BaseChat extends AIChatAgent<Env> implements MixinMethods {
  messages: UIMessage[] = [];

  // Declare mixin methods so TypeScript knows they exist at runtime
  // These will be added by the mixin functions
  getClaims!: MixinMethods["getClaims"];
  getCredentials!: MixinMethods["getCredentials"];
  getCredentialsFromConnection!: MixinMethods["getCredentialsFromConnection"];
  requireAuth!: MixinMethods["requireAuth"];
  setOwner!: MixinMethods["setOwner"];
  getOwner!: MixinMethods["getOwner"];
  scheduleAsyncUserConfirmationCheck!: MixinMethods["scheduleAsyncUserConfirmationCheck"];
  asyncUserConfirmationCheck!: MixinMethods["asyncUserConfirmationCheck"];

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

// Augment the Chat type to include mixin method
export type ChatInstance = BaseChat & MixinMethods & AIChatAgent<Env>;

// Apply mixins in the correct order
const AuthedChat = AuthAgent(BaseChat as any);
const OwnedAuthedChat = OwnedAgent(AuthedChat);
export const Chat = AsyncUserConfirmationResumer(OwnedAuthedChat);

// Export the instance type
export type Chat = ChatInstance;
