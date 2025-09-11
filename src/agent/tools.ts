/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod/v3";

import { getCurrentAgent } from "agents";
import { unstable_scheduleSchema } from "agents/schedule";
import { format, toZonedTime } from "date-fns-tz";
import { buyStock } from "./auth0-ai-sample-tools/buy-stock";
import { checkUsersCalendar } from "./auth0-ai-sample-tools/check-user-calendar";
import type { Chat } from "./chat";

/**
 * Weather information tool that requires human confirmation
 * This tool does NOT have an execute function, so it will pause in "input-available" state
 * waiting for user approval via the UI. The actual execution is in the executions object.
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() }),
  // No execute function - this will make the tool pause for confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({
    timeZone: z.string().describe("IANA time zone name"),
  }),
  execute: async ({ timeZone: location }) => {
    const now = new Date();
    const zonedDate = toZonedTime(now, location);
    const output = format(zonedDate, "yyyy-MM-dd HH:mm:ssXXX", {
      timeZone: location,
    });
    return output;
  },
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  checkUsersCalendar,
  buyStock,
};

/**
 * Execution functions for tools that require human confirmation
 * These are separate from the tool definitions to allow for approval flow
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    // removed debug log

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return `The weather in ${city} is sunny and 72°F with light clouds.`;
  },
  // Note: checkUsersCalendar is not included here because it has its own execute function
  // and handles Auth0 AI federated connection flow automatically
};
