import { getCurrentUser } from "@/lib/auth";
import { CHAT_EVENT, chatBus, type ChatMessage } from "@/lib/events";

// Long-lived SSE connection. Subscribes to the in-memory chat bus and streams
// each new message to the client as a `data:` event.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval>;
  let onMessage: (message: ChatMessage) => void;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      // Initial comment so clients open the stream immediately.
      safeEnqueue(encoder.encode(": connected\n\n"));

      onMessage = (message: ChatMessage) => {
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "message", message })}\n\n`),
        );
      };
      chatBus.on(CHAT_EVENT, onMessage);

      // Heartbeat keeps intermediaries from closing an idle connection.
      heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        chatBus.off(CHAT_EVENT, onMessage);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      clearInterval(heartbeat);
      if (onMessage) chatBus.off(CHAT_EVENT, onMessage);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
