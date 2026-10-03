import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { row } from "@/lib/db";
import { readSession, SESSION_COOKIE, type Session } from "@/lib/session";

/** Who's signed in, from the session cookie — or null. */
export const getSession = cache(async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
});

/**
 * The signed-in user, or a trip to the login page. Every page and action that
 * reads or changes team data calls this first.
 */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** The signed-in user's team member id — what "Me" means. */
export const getCurrentMemberId = cache(async function getCurrentMemberId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const member = await row<{ id: string }>("SELECT id FROM team_members WHERE user_id = ?", [
    session.userId,
  ]);
  return member?.id ?? null;
});
