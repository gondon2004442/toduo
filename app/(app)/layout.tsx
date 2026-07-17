import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar displayName={user.displayName} username={user.username} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
