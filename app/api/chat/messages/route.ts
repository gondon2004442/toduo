import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishMessage, type ChatMessage } from "@/lib/events";

type MessageRow = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  body: string;
  created_at: string;
};

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

// GET /api/chat/messages — recent history, oldest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const rows = db
    .prepare(
      `SELECT m.id, m.user_id, u.username, u.display_name, m.body, m.created_at
         FROM messages m
         JOIN users u ON u.id = m.user_id
        ORDER BY m.id DESC
        LIMIT 200`,
    )
    .all() as MessageRow[];

  const messages = rows.reverse().map(toChatMessage);
  return NextResponse.json({ messages });
}

// POST /api/chat/messages — persist a message and fan it out over SSE.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let payload: { body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const body = payload.body?.trim();
  if (!body) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: "Слишком длинное сообщение" }, { status: 400 });
  }

  const info = db
    .prepare("INSERT INTO messages (user_id, body) VALUES (?, ?)")
    .run(user.id, body);

  const row = db
    .prepare(
      `SELECT m.id, m.user_id, u.username, u.display_name, m.body, m.created_at
         FROM messages m
         JOIN users u ON u.id = m.user_id
        WHERE m.id = ?`,
    )
    .get(Number(info.lastInsertRowid)) as MessageRow;

  const message = toChatMessage(row);
  publishMessage(message);

  return NextResponse.json({ message });
}
