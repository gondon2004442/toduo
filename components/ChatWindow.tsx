"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/events";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

type Props = {
  currentUserId: number;
};

export default function ChatWindow({ currentUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef<Set<number>>(new Set());

  const addMessage = useCallback((message: ChatMessage) => {
    if (seenIds.current.has(message.id)) return;
    seenIds.current.add(message.id);
    setMessages((prev) => [...prev, message]);
  }, []);

  // Load history once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/messages");
        if (!res.ok) return;
        const data: { messages: ChatMessage[] } = await res.json();
        if (cancelled) return;
        for (const m of data.messages) seenIds.current.add(m.id);
        setMessages(data.messages);
      } catch {
        // ignore — SSE will still deliver new messages
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to the live stream.
  useEffect(() => {
    const source = new EventSource("/api/chat/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "message") {
          addMessage(payload.message as ChatMessage);
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => source.close();
  }, [addMessage]);

  const handleSend = useCallback(async (body: string) => {
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error("send failed");
    // The message arrives back through the SSE stream, so no local echo here.
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Чат команды</h2>
          <p className="text-xs text-muted">Живая переписка</p>
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs ${
            connected ? "text-green-600" : "text-muted"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          {connected ? "онлайн" : "подключение…"}
        </span>
      </header>

      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
