// Component imports

// Icon imports
import ChatList from "@/components/chatList";
import { useNavigate } from "react-router";
import useUser from "../hooks/useUser";
import { Layout } from "./Layout";
import { createNewChat } from "./chats";

export default function Home() {
  console.log("Rendering Home component");
  const { user } = useUser();
  const navigate = useNavigate();

  return (
    <Layout>
      <Layout.Content>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 max-h-[calc(100vh-10rem)]">
          <p>Welcome to the Agents Demo!</p>
          {!user && (
            <p>
              Please log in to use the full features of the app. &nbsp;
              <a href="/auth/login" className="text-blue-500 hover:underline">
                Log in
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={() => createNewChat(navigate)}
            className="text-sm font-medium py-2 px-4 rounded-lg shadow transition cursor-pointer"
          >
            New Chat
          </button>

          {user && <ChatList />}
        </div>
      </Layout.Content>
    </Layout>
  );
}
