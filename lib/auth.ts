import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };
const SESSION_TTL_DAYS = 30;

export type User = {
  id: number;
  username: string;
  displayName: string;
};

type UserRow = {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createUser(
  username: string,
  displayName: string,
  passwordHash: string,
): User {
  const info = db
    .prepare(
      "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
    )
    .run(username, displayName, passwordHash);
  return {
    id: Number(info.lastInsertRowid),
    username,
    displayName,
  };
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
}

export function createSession(userId: number): string {
  const id = randomBytes(32).toString("hex");
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(id, userId, expires.toISOString());
  return id;
}

export function destroySession(sessionId: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

/**
 * Resolve the currently authenticated user from the session cookie.
 * Returns null when there is no valid, unexpired session.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .get(sessionId) as
    | { id: number; username: string; display_name: string; expires_at: string }
    | undefined;

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(sessionId);
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
  };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
};
