import { EventEmitter } from "node:events";

// In-memory pub/sub used to fan out chat messages to all open SSE streams.
// Single-process only — sufficient for a small prototype (two users, one server).

export type ChatMessage = {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  body: string;
  createdAt: string;
};

const globalForBus = globalThis as unknown as { __toduoBus?: EventEmitter };

export const chatBus: EventEmitter =
  globalForBus.__toduoBus ??
  (() => {
    const bus = new EventEmitter();
    // Two users can each hold multiple tabs open; lift the default cap.
    bus.setMaxListeners(100);
    return bus;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForBus.__toduoBus = chatBus;
}

export const CHAT_EVENT = "chat:message";

export function publishMessage(message: ChatMessage) {
  chatBus.emit(CHAT_EVENT, message);
}
