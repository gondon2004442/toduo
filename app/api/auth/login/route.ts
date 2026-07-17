import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSession,
  findUserByUsername,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  let payload: { username?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const username = payload.username?.trim().toLowerCase();
  const password = payload.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Введите логин и пароль" },
      { status: 400 },
    );
  }

  const row = findUserByUsername(username);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json(
      { error: "Неверный логин или пароль" },
      { status: 401 },
    );
  }

  const sessionId = createSession(row.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, sessionCookieOptions);

  return NextResponse.json({
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
    },
  });
}
