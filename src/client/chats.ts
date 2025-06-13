import type { NavigateFunction } from "react-router";

export const createNewChat = async (navigate: NavigateFunction) => {
  const response = await fetch("/api/chats", {
    method: "POST",
    credentials: "include",
  });
  if (response.status === 401) {
    window.location.href = "/c/new";
    return;
  }
  const { id } = (await response.json()) as { id: string };
  await navigate(`/c/${id}`);
};
