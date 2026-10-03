import { SignJWT, jwtVerify } from "jose";

/**
 * The login session: a signed token in an httpOnly cookie. Works in both the
 * middleware (edge) and server code, so it only uses `jose`.
 */
export const SESSION_COOKIE = "pt_session";
export const SESSION_DAYS = 30;

export type Session = { userId: string; email: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

/** The session in a token, or null if it's missing, tampered with or expired. */
export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { userId: payload.sub, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export const sessionCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
