"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  displayName: string;
  username: string;
};

const nav = [
  { href: "/chat", label: "Чат", icon: "💬" },
  { href: "/tasks", label: "Задачи", icon: "✓" },
];

export default function Sidebar({ displayName, username }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-sm font-semibold text-white">
          T
        </div>
        <span className="font-semibold text-ink">Toduo</span>
      </div>

      <nav className="flex-1 px-2">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                active
                  ? "bg-line/70 font-medium text-ink"
                  : "text-muted hover:bg-line/50 hover:text-ink"
              }`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {(displayName || username).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">
              {displayName}
            </div>
            <div className="truncate text-xs text-muted">@{username}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted transition hover:bg-line/50 hover:text-ink"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}
