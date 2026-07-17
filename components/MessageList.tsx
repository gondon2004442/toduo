"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/events";

type Props = {
  messages: ChatMessage[];
  currentUserId: number;
};

function formatTime(iso: string): string {
  // SQLite stores UTC ("YYYY-MM-DD HH:MM:SS"); normalize to a Date.
  const date = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageList({ messages, currentUserId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        Пока сообщений нет. Напишите первое 👇
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((m) => {
          const mine = m.userId === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  mine
                    ? "bg-accent text-white"
                    : "bg-sidebar text-ink"
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 text-xs font-medium text-muted">
                    {m.displayName}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm">
                  {m.body}
                </div>
                <div
                  className={`mt-1 text-right text-[10px] ${
                    mine ? "text-white/70" : "text-muted"
                  }`}
                >
                  {formatTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
