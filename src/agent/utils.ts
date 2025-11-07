// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import type { ToolExecutionOptions } from "@auth0/ai-vercel";
import {
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
  type UIMessagePart,
  type UIMessageStreamWriter,
  type UITools,
  convertToModelMessages,
} from "ai";
import type { z } from "zod";
import { APPROVAL } from "./shared";

function isValidToolName<K extends PropertyKey, T extends object>(
  key: K,
  obj: T
): key is K & keyof T {
  return key in obj;
}

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 *
 * @param options - The function options
 * @param options.tools - Map of tool names to Tool instances that may expose execute functions
 * @param options.dataStream - Data stream for sending results back to the client
 * @param options.messages - Array of messages to process
 * @param executionFunctions - Map of tool names to execute functions
 * @returns Promise resolving to the processed messages
 */
export async function processToolCalls<
  Tools extends ToolSet,
  ExecutableTools extends {
    // biome-ignore lint/complexity/noBannedTypes: it's fine
    [Tool in keyof Tools as Tools[Tool] extends { execute: Function }
      ? never
      : Tool]: Tools[Tool];
  },
>({
  dataStream,
  messages,
  executions,
}: {
  tools: Tools; // used for type inference
  dataStream: UIMessageStreamWriter<UIMessage<unknown, UIDataTypes, UITools>>;
  messages: UIMessage[];
  executions: {
    [K in keyof Tools & keyof ExecutableTools]?: (
      args: z.infer<
        ExecutableTools[K]["inputSchema"] & z.ZodType<any, any, any>
      >,
      context: ToolExecutionOptions
    ) => Promise<unknown>;
  };
}): Promise<UIMessage[]> {
  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;
  if (!parts) return messages;

  const processedParts = await Promise.all(
    parts.map(async (part) => {
      // Only process tool invocations parts
      if (!part.type.startsWith("tool-")) return part;

      const toolName = part.type.split("-")[1];

      // Only continue if we have an execute function for the tool (meaning it requires confirmation) and it's in a 'output-available' state
      if (
        !(toolName in executions) ||
        !("state" in part) ||
        part.state !== "output-available"
      )
        return part;

      let result: unknown;

      if (part.output === APPROVAL.YES) {
        // Get the tool and check if the tool has an execute function.
        if (
          !isValidToolName(toolName, executions) ||
          part.state !== "output-available"
        ) {
          return part;
        }

        const toolInstance = executions[toolName];
        if (toolInstance) {
          result = await toolInstance(part.input, {
            messages: convertToModelMessages(messages),
            toolCallId: part.toolCallId,
          });
        } else {
          result = "Error: No execute function found on tool";
        }
      } else if (part.output === APPROVAL.NO) {
        result = "Error: User denied access to tool execution";
      } else {
        // For any unhandled responses, return the original part.
        return part;
      }

      // Forward updated tool result to the client.
      dataStream.write({
        type: "finish-step",
      });

      // Return updated part with the actual result.
      return {
        ...part,
        output: result,
      } as UIMessagePart<UIDataTypes, UITools>;
    })
  );

  // Finally return the processed messages
  return [...messages.slice(0, -1), { ...lastMessage, parts: processedParts }];
}
