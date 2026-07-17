import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSession,
  createUser,
  findUserByUsername,
  hashPassword,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  let payload: { username?: string; displayName?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const username = payload.username?.trim().toLowerCase();
  const displayName = payload.displayName?.trim() || username;
  const password = payload.password ?? "";

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "Логин: минимум 3 символа" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Пароль: минимум 6 символов" },
      { status: 400 },
    );
  }

  if (findUserByUsername(username)) {
    return NextResponse.json(
      { error: "Такой логин уже занят" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = createUser(username, displayName!, passwordHash);
  const sessionId = createSession(user.id);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, sessionCookieOptions);

  return NextResponse.json({ user });
}
