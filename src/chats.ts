import { generateId } from "ai";

/**
 * This file contains the logic for creating and listing chats.
 */

type ChatListItem = {
  id: string;
  createdAt: number;
  title: string;
};

export const createNewChat = async ({
  userID,
  env,
}: {
  userID: string;
  env: Env;
}): Promise<string> => {
  const id = generateId();
  const chatID = env.Chat.idFromName(id);
  const stub = env.Chat.get(chatID);
  // @ts-expect-error setOwner is not typed
  await stub.setOwner(userID);
  //insert the chat into the list
  await env.ChatList.put(
    userID,
    JSON.stringify([
      ...((await env.ChatList.get<ChatListItem[]>(userID, "json")) ?? []),
      {
        id,
        createdAt: Date.now(),
        title: "New Chat",
      },
    ])
  );
  return id;
};

export const listChats = async ({
  userID,
  env,
}: {
  userID: string;
  env: Env;
}): Promise<ChatListItem[]> => {
  const chats: ChatListItem[] =
    (await env.ChatList.get<ChatListItem[]>(userID, "json")) ?? [];

  // sort and take only the last 5 chats
  const sortedChats = chats
    .sort((a, b) => {
      return b.createdAt - a.createdAt;
    })
    .slice(0, 5);

  return sortedChats;
};

export const setChatTitle = async ({
  userID,
  chatID,
  title,
  env,
}: {
  userID: string;
  chatID: string;
  title: string;
  env: Env;
}): Promise<void> => {
  const chats: ChatListItem[] =
    (await env.ChatList.get<ChatListItem[]>(userID, "json")) ?? [];

  const updatedChats = chats.map((chat) => {
    if (chat.id === chatID) {
      return { ...chat, title };
    }
    return chat;
  });

  await env.ChatList.put(userID, JSON.stringify(updatedChats));
};

export const getChat = async ({
  userID,
  chatID,
  env,
}: {
  userID: string;
  chatID: string;
  env: Env;
}): Promise<ChatListItem | undefined> => {
  const chats: ChatListItem[] =
    (await env.ChatList.get<ChatListItem[]>(userID, "json")) ?? [];

  const chat = chats.find((chat) => chat.id === chatID);

  return chat;
};
