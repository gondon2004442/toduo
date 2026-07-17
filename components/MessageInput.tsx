"use client";

import { useState } from "react";

type Props = {
  onSend: (body: string) => Promise<void>;
};

export default function MessageInput({ onSend }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    setValue("");
    try {
      await onSend(body);
    } catch {
      // Restore the text so the user doesn't lose it on failure.
      setValue(body);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="border-t border-line bg-canvas px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Напишите сообщение…  (Enter — отправить, Shift+Enter — новая строка)"
          className="max-h-40 min-h-[42px] flex-1 resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={() => void submit()}
          disabled={sending || !value.trim()}
          className="h-[42px] shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-50"
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
