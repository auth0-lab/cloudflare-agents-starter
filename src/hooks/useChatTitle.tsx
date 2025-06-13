import useSWR from "swr";

const titleFetcher = async (chatID: string) => {
  const response = await fetch(`/api/chats/${chatID}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("An error occurred while fetching the title of the chat.");
  }
  const { title } = (await response.json()) as { title: string };
  return title || "New Chat";
};

export default function useChatTitle(chatID: string): {
  loading: boolean;
  title: string;
  mutate: () => void;
} {
  const { data, mutate, error } = useSWR(chatID, titleFetcher, {
    refreshInterval: 10000,
  });

  const loading = !data && !error;

  return {
    loading,
    mutate,
    title: data ?? "New Chat",
  };
}
