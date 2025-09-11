// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import type {
  CoreMessage,
  ToolSet,
  UIMessage,
  UIMessageStreamWriter,
} from "ai";
import { convertToModelMessages, isToolUIPart } from "ai";
import { APPROVAL } from "./shared";

interface ToolContext {
  messages: CoreMessage[];
  toolCallId: string;
}

function isValidToolName<K extends PropertyKey, T extends object>(
  key: K,
  obj: T
): key is K & keyof T {
  return key in obj;
}

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 */
export async function processToolCalls<Tools extends ToolSet>({
  dataStream,
  messages,
  executions,
}: {
  tools: Tools; // used for type inference
  dataStream: UIMessageStreamWriter;
  messages: UIMessage[];
  executions: Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: needs a better type
    (args: any, context: ToolContext) => Promise<unknown>
  >;
}): Promise<UIMessage[]> {
  // removed verbose debug logs

  // Process all messages, not just the last one
  const processedMessages = await Promise.all(
    messages.map(async (message) => {
      // debug logs removed
      const parts = message.parts;
      if (!parts) return message;

      const processedParts = await Promise.all(
        parts.map(async (part) => {
          // Only process tool UI parts
          if (!isToolUIPart(part)) return part;

          // Cast to any to avoid TS narrowing issues from the SDK types
          const p: any = part as any;

          const toolName = p.type.replace(
            "tool-",
            ""
          ) as keyof typeof executions;

          // Check if this is a continueInterruption case
          const isContinueInterruption =
            part.state === "output-available" &&
            part.output &&
            typeof part.output === "object" &&
            "continueInterruption" in part.output &&
            part.output.continueInterruption === true;

          // If this is a continueInterruption, convert it into an input-available part
          // and clear any errorText/output so the agent / model will attempt the tool call
          // again after the resume flow. Leaving errorText or output with
          // continueInterruption prevents the SDK from re-invoking the tool.
          if (isContinueInterruption) {
            // Convert to a fresh input-available part so the SDK will invoke the tool.execute path.
            return {
              ...(p as any),
              state: "input-available" as const,
              output: undefined,
              errorText: undefined,
              callProviderMetadata: undefined,
              providerExecuted: undefined,
            };
          }

          // Only process tools that require confirmation (are in executions object).
          // Allow execution when in 'input-available' state or when the part
          // has been approved by the user (output === APPROVAL.YES) and is
          // in 'output-available' (UI added approval as output).
          const approved = p.output === APPROVAL.YES;
          if (
            !(toolName in executions) ||
            isContinueInterruption ||
            !(
              p.state === "input-available" ||
              (p.state === "output-available" && approved)
            )
          )
            return p;

          // removed debug logs

          let result: unknown;

          // Approval is provided via part.output (client adds output when user approves).
          if (p.output === APPROVAL.YES) {
            // User approved the tool execution
            // executing approved tool
            if (!isValidToolName(toolName, executions)) {
              return part;
            }

            const toolInstance = executions[toolName];
            if (toolInstance) {
              // Execute the tool using the original input (part.input)
              // which contains the tool args; approval is in part.output.
              result = await toolInstance(p.input, {
                messages: convertToModelMessages(messages),
                toolCallId: p.toolCallId,
              });
              // tool execution result
            } else {
              result = "Error: No execute function found on tool";
            }
          } else if (p.output === APPROVAL.NO) {
            // tool denied by user
            result = "Error: User denied access to tool execution";
          } else {
            // no approval decision yet
            // If no approval input yet, leave the part as-is for user interaction
            return p;
          }

          // Forward updated tool result to the client.
          dataStream.write({
            type: "data-tool-result",
            data: {
              toolCallId: p.toolCallId,
              result: result,
            },
          });

          // Return updated tool part with the actual result.
          return {
            ...(p as any),
            state: "output-available" as const,
            output: result,
          };
        })
      );

      return { ...message, parts: processedParts };
    })
  );

  return processedMessages;
}

/**
 * Clean up incomplete tool calls from messages before sending to API
 * Prevents API errors from interrupted or failed tool executions
 */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    if (!message.parts) return true;

    // Filter out messages with incomplete tool calls
    const hasIncompleteToolCall = message.parts.some((part) => {
      if (!isToolUIPart(part)) return false;

      // Treat continueInterruption from provider as an incomplete call that
      // must be removed before sending to the model so it will re-request
      // the tool (and allow the SDK to invoke tool.execute).
      if (
        part.state === "output-available" &&
        part.output &&
        typeof part.output === "object" &&
        "continueInterruption" in part.output &&
        part.output.continueInterruption === true
      ) {
        return true;
      }

      // Remove tool calls that are still streaming or awaiting input without results
      return (
        part.state === "input-streaming" ||
        (part.state === "input-available" && !part.output && !part.errorText)
      );
    });

    return !hasIncompleteToolCall;
  });
}
