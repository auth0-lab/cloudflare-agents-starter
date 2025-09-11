import type { UIMessage } from "@ai-sdk/react";

import { useAgent } from "agents/react";
import { use, useCallback, useEffect, useRef, useState } from "react";
import type { tools } from "../agent/tools";

import { useAgentChatInterruptions } from "@auth0/ai-cloudflare/react";

// Component imports
import { Avatar } from "@/components/avatar/Avatar";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { Textarea } from "@/components/textarea/Textarea";
import { Toggle } from "@/components/toggle/Toggle";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";

// Icon imports
import { GoogleCalendarIcon } from "@/components/auth0-ai/FederatedConnections/icons";
import { EnsureAPIAccessPopup } from "@/components/auth0-ai/FederatedConnections/popup";
import useChatTitle from "@/hooks/useChatTitle";
import { FederatedConnectionInterrupt } from "@auth0/ai/interrupts";
import { Bug, PaperPlaneTilt, Robot, Trash } from "@phosphor-icons/react";
import { useNavigate, useParams } from "react-router";
import { Tooltip } from "../components/tooltip/Tooltip";
import useUser from "../hooks/useUser";
import { Layout } from "./Layout";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation",
];

export default function Chat() {
  const navigate = useNavigate();
  const { loggedOut } = useUser();
  const { threadID } = useParams<{ threadID: string }>();

  const [showDebug, setShowDebug] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const { title } = useChatTitle(threadID!);

  useEffect(() => {
    document.title = `AI Chat - ${title}`;
  }, [title]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (!loggedOut) return;
    navigate("/");
  }, [loggedOut, navigate]);

  const agent = useAgent({
    agent: "chat",
    name: threadID ?? undefined,
  });

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory,
    toolInterrupt,
    sendMessage,
  } = useAgentChatInterruptions({
    agent,
    id: threadID,
  });

  // Create our own input state since the hook doesn't provide input management
  const [inputValue, setInputValue] = useState("");

  // Create our own input change handler
  const handleAgentInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInputValue(e.target.value);
  };

  // Create our own submit handler
  const handleAgentSubmit = async (e: React.FormEvent, options?: any) => {
    e.preventDefault();
    if (!inputValue?.trim()) return;

    // Create the message object that sendMessage expects
    const messageToSend = {
      role: "user" as const,
      parts: [
        {
          type: "text" as const,
          text: inputValue,
        },
      ],
    };

    // Send message using the hook's sendMessage function
    try {
      await sendMessage(messageToSend);
      setInputValue("");
    } catch (error) {
      console.error("Error sending message to agent:", error);
    }
  };

  // Create a wrapper for addToolResult to match the expected signature
  const handleAddToolResult = (args: {
    toolName: string;
    toolCallId: string;
    result: string;
  }) => {
    try {
      addToolResult({
        tool: args.toolName,
        toolCallId: args.toolCallId,
        output: args.result,
      });
    } catch (error) {
      console.error("Error calling addToolResult:", error);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    agentMessages.length > 0 && scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part: any) =>
        part.type?.startsWith("tool-") &&
        part.state === "input-available" &&
        toolsRequiringConfirmation.includes(part.toolName as keyof typeof tools)
    )
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Layout>
      <Layout.Toolbar>
        <Tooltip content="Debug Mode" className="flex items-center gap-2 mr-2">
          <Bug size={16} />
          <Toggle
            toggled={showDebug}
            aria-label="Toggle debug mode"
            onClick={() => setShowDebug((prev) => !prev)}
          />
        </Tooltip>

        <Button
          variant="ghost"
          size="md"
          shape="square"
          className="rounded-full h-9 w-9"
          tooltip={"Clear History"}
          onClick={clearHistory}
        >
          <Trash size={20} />
        </Button>
      </Layout.Toolbar>
      <Layout.Content>
        <HasOpenAIKey />
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-10rem)]">
          {agentMessages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900">
                <div className="text-center space-y-4">
                  <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-3 inline-flex">
                    <Robot size={24} />
                  </div>
                  <h3 className="font-semibold text-lg">Welcome to AI Chat</h3>
                  <p className="text-muted-foreground text-sm">
                    Start a conversation with your AI assistant. Try asking
                    about:
                  </p>
                  <ul className="text-sm text-left space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="text-[#F48120]">•</span>
                      <span>Weather information for any city</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#F48120]">•</span>
                      <span>Local time in different locations</span>
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          )}

          {agentMessages.map((m: UIMessage, index) => {
            const isUser = m.role === "user";
            const showAvatar =
              index === 0 || agentMessages[index - 1]?.role !== m.role;

            return (
              <div key={m.id}>
                {showDebug && (
                  <pre className="text-xs text-muted-foreground overflow-scroll">
                    {JSON.stringify(m, null, 2)}
                  </pre>
                )}
                <div
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex gap-2 max-w-[85%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {showAvatar && !isUser ? (
                      <Avatar username={"AI"} />
                    ) : (
                      !isUser && <div className="w-8" />
                    )}

                    <div>
                      <div>
                        {m.parts?.map((part: any, i: number) => {
                          if (part.type === "text") {
                            return (
                              // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
                              <div key={i}>
                                <Card
                                  className={`p-3 rounded-md bg-neutral-100 dark:bg-neutral-900 ${
                                    isUser
                                      ? "rounded-br-none"
                                      : "rounded-bl-none border-assistant-border"
                                  } ${
                                    part.text.startsWith("scheduled message")
                                      ? "border-accent/50"
                                      : ""
                                  } relative`}
                                >
                                  {part.text.startsWith(
                                    "scheduled message"
                                  ) && (
                                    <span className="absolute -top-3 -left-2 text-base">
                                      🕒
                                    </span>
                                  )}
                                  <MemoizedMarkdown
                                    id={`${m.id}-${i}`}
                                    content={part.text.replace(
                                      /^scheduled message: /,
                                      ""
                                    )}
                                  />
                                </Card>
                                <p
                                  className={`text-xs text-muted-foreground mt-1 ${
                                    isUser ? "text-right" : "text-left"
                                  }`}
                                >
                                  {formatTime(
                                    new Date(Number(m.id) || Date.now())
                                  )}
                                </p>
                              </div>
                            );
                          }

                          if (part.type?.startsWith("tool-")) {
                            const toolCallId = part.toolCallId;
                            const toolName = part.toolName;
                            // Prevent duplicate rendering for the same toolCallId
                            // within a single assistant message.
                            const seenToolCallIds = new Set<string>();
                            if (seenToolCallIds.has(toolCallId)) return null;
                            seenToolCallIds.add(toolCallId);

                            // Check for federated connection interrupts (render popup on call or when input is available)
                            if (
                              toolInterrupt &&
                              FederatedConnectionInterrupt.isInterrupt(
                                toolInterrupt
                              )
                            ) {
                              return (
                                <EnsureAPIAccessPopup
                                  key={toolCallId}
                                  interrupt={toolInterrupt}
                                  auth={{ authorizePath: "/auth/login" }}
                                  connectWidget={{
                                    icon: (
                                      <div className="bg-gray-200 p-3 rounded-lg flex-wrap">
                                        <GoogleCalendarIcon />
                                      </div>
                                    ),
                                    title: "Google Calendar Access",
                                    description:
                                      "We need access to your google Calendar in order to call this tool...",
                                    action: { label: "Grant" },
                                  }}
                                />
                              );
                            }

                            const needsConfirmation =
                              toolsRequiringConfirmation.includes(
                                toolName as keyof typeof tools
                              );

                            // Skip rendering the card in debug mode
                            if (showDebug) return null;

                            const toolInvocation = {
                              toolName: toolName,
                              toolCallId: toolCallId,
                              state: part.state,
                              args: part.input || {},
                              output: part.output,
                              input: part.input,
                            };

                            return (
                              <ToolInvocationCard
                                // biome-ignore lint/suspicious/noArrayIndexKey: using index is safe here as the array is static
                                key={`${toolCallId}-${i}`}
                                toolInvocation={toolInvocation}
                                toolCallId={toolCallId}
                                needsConfirmation={needsConfirmation}
                                addToolResult={handleAddToolResult}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        {/* Input Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAgentSubmit(e, {
              data: {
                annotations: {
                  hello: "world",
                },
              },
            });
            setTextareaHeight("auto"); // Reset height after submission
          }}
          className="p-3 bg-neutral-50 absolute bottom-0 left-0 right-0 z-10 border-t border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Textarea
                disabled={pendingToolCallConfirmation}
                placeholder={
                  pendingToolCallConfirmation
                    ? "Please respond to the tool confirmation above..."
                    : "Send a message..."
                }
                className="flex w-full border border-neutral-200 dark:border-neutral-700 px-3 py-2 ring-offset-background placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pb-10 dark:bg-neutral-900"
                value={inputValue}
                onChange={(e) => {
                  handleAgentInputChange(e);
                  // Auto-resize the textarea
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setTextareaHeight(`${e.target.scrollHeight}px`);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleAgentSubmit(e as unknown as React.FormEvent);
                    setTextareaHeight("auto"); // Reset height on Enter submission
                  }
                }}
                rows={2}
                style={{ height: textareaHeight }}
              />
              <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-1.5 h-fit border border-neutral-200 dark:border-neutral-800"
                  disabled={pendingToolCallConfirmation || !inputValue?.trim()}
                >
                  <PaperPlaneTilt size={16} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </Layout.Content>
    </Layout>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key", {
  credentials: "include",
}).then((res) => res.json<{ success: boolean }>());

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    OPENAI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
