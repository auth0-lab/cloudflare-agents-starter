import { APPROVAL } from "@/agent/shared";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Tooltip } from "@/components/tooltip/Tooltip";
import type { useAgentChatInterruptions } from "@auth0/ai-cloudflare/react";
import { CaretDown, Robot } from "@phosphor-icons/react";
import { useState } from "react";
interface ToolInvocationCardProps {
  toolCallId: string;
  needsConfirmation: boolean;
  addToolResult: ReturnType<typeof useAgentChatInterruptions>["addToolResult"];
  part: any;
}

export function ToolInvocationCard({
  toolCallId,
  needsConfirmation,
  addToolResult,
  part,
}: ToolInvocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card
      className={`p-4 my-3 w-full max-w-[500px] rounded-md bg-neutral-100 dark:bg-neutral-900 ${
        needsConfirmation ? "" : "border-[#F48120]/30"
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <div
          className={`${needsConfirmation ? "bg-[#F48120]/10" : "bg-[#F48120]/5"} p-1.5 rounded-full flex-shrink-0`}
        >
          <Robot size={16} className="text-[#F48120]" />
        </div>
        <h4 className="font-medium flex items-center gap-2 flex-1 text-left">
          {part.type.split("-")[1]}
          {!needsConfirmation && part.state === "output-available" && (
            <span className="text-xs text-[#F48120]/70">✓ Completed</span>
          )}
        </h4>
        <CaretDown
          size={16}
          className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ${isExpanded ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "180px" : "0px" }}
        >
          <div className="mb-3">
            <h5 className="text-xs font-medium mb-1 text-muted-foreground">
              Arguments:
            </h5>
            <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          </div>

          {needsConfirmation && part.state === "input-available" && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  addToolResult({
                    tool: part.type.split("-")[1],
                    toolCallId,
                    output: APPROVAL.NO,
                  })
                }
              >
                Reject
              </Button>
              <Tooltip content={"Accept action"}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    addToolResult({
                      tool: part.type.split("-")[1],
                      toolCallId,
                      output: APPROVAL.YES,
                    })
                  }
                >
                  Approve
                </Button>
              </Tooltip>
            </div>
          )}

          {!needsConfirmation && part.state === "output-available" && (
            <div className="mt-3 border-t border-[#F48120]/10 pt-3">
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Result:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
                {(() => {
                  const result = part.output;
                  if (typeof result === "object" && result.content) {
                    return result.content
                      .map((item: { type: string; text: string }) => {
                        if (
                          item.type === "text" &&
                          item.text.startsWith("\n~ Page URL:")
                        ) {
                          const lines = item.text.split("\n").filter(Boolean);
                          return lines
                            .map(
                              (line: string) => `- ${line.replace("\n~ ", "")}`
                            )
                            .join("\n");
                        }
                        return item.text;
                      })
                      .join("\n");
                  }
                  return JSON.stringify(result, null, 2);
                })()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
