import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    destroySession(sessionId);
    cookieStore.delete(SESSION_COOKIE);
  }
  return NextResponse.json({ ok: true });
}
