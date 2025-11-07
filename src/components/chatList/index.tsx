import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

type Chat = {
  id: string;
  createdAt: number;
  title: string;
};

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => res.json() as Promise<Chat[]>)
      .then((data) => {
        const sorted = [...data].sort((a, b) => b.createdAt - a.createdAt);
        setChats(sorted.slice(0, 5));
      })
      .catch((err) => console.error("Error fetching chats:", err));
  }, []);

  if (chats.length === 0) {
    return;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold text-neutral-800">Recent chats</h1>
      <div className="space-y-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className="border rounded-xl p-4 hover:bg-neutral-100 transition cursor-pointer"
            onClick={() => navigate(`/c/${chat.id}`)}
            onKeyDown={() => navigate(`/c/${chat.id}`)}
          >
            <h2 className="text-lg font-medium text-neutral-900">
              {chat.title}
            </h2>
            <p className="text-sm text-neutral-500">
              {formatDistanceToNow(chat.createdAt, { addSuffix: true })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
