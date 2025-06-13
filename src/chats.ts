import { generateId } from "ai";
import type { Context } from "hono";
import type { HonoEnv } from "./server";

/**
 * This file contains the logic for creating and listing chats.
 */

type ChatListItem = {
  id: string;
  createdAt: number;
};

export const createNewChat = async (c: Context<HonoEnv>): Promise<string> => {
  const id = generateId();
  const chatID = c.env.Chat.idFromName(id);
  const stub = c.env.Chat.get(chatID);
  const session = await c.var.auth0Client?.getSession(c);
  const userID = session?.user?.sub;
  if (!userID) {
    throw new Error("User not authenticated");
  }
  await stub.setOwner(userID);
  //insert the chat into the list
  await c.env.ChatList.put(
    userID,
    JSON.stringify([
      ...((await c.env.ChatList.get<ChatListItem[]>(userID, "json")) ?? []),
      {
        id,
        createdAt: Date.now(),
      },
    ])
  );
  return id;
};

type ChatListItemWithTitle = ChatListItem & {
  title: string;
};

export const listChats = async (
  c: Context<HonoEnv>
): Promise<ChatListItemWithTitle[]> => {
  const session = await c.var.auth0Client?.getSession(c);
  const userID = session?.user?.sub;
  if (!userID) {
    throw new Error("User not authenticated");
  }
  const chats: ChatListItem[] =
    (await c.env.ChatList.get<ChatListItem[]>(userID, "json")) ?? [];
  // sort and take only the last 5 chats
  const sortedChats = chats
    .sort((a, b) => {
      return b.createdAt - a.createdAt;
    })
    .slice(0, 5);
  // Get the chat titles from the chat agents directly.
  const chatsWithTitle = await Promise.all(
    sortedChats.map(async (chat) => {
      const chatID = c.env.Chat.idFromName(chat.id);
      const stub = c.env.Chat.get(chatID);
      const title = await stub.getTitle();
      return {
        ...chat,
        title,
      };
    })
  );
  return chatsWithTitle;
};
