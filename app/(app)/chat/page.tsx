import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChatWindow from "@/components/ChatWindow";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ChatWindow currentUserId={user.id} />;
}
