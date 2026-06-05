import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@/lib/domain/types";
import { getCreditRepository } from "@/lib/store";

const SESSION_COOKIE = "agent_to_token_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

export async function loginWithEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await getCreditRepository().getOrCreateUserByEmail(normalizedEmail);
  await setSessionCookie(user);
  return user;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | undefined> {
  const payload = await getSessionPayload();
  if (!payload) {
    return undefined;
  }

  try {
    return await getCreditRepository().requireUser(payload.userId);
  } catch {
    return undefined;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export class AuthRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super("Login required.");
  }
}

export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("A valid email is required.");
  }
  return normalized;
}

async function setSessionCookie(user: User) {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const value = signPayload({
    userId: user.id,
    email: user.email,
    exp: expiresAtSeconds
  });

  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

async function getSessionPayload() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) {
    return undefined;
  }

  const payload = verifyPayload(value);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) {
    return undefined;
  }
  return payload;
}

function signPayload(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function verifyPayload(value: string): SessionPayload | undefined {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof parsed.userId !== "string" || typeof parsed.email !== "string" || typeof parsed.exp !== "number") {
      return undefined;
    }
    return {
      userId: parsed.userId,
      email: parsed.email,
      exp: parsed.exp
    };
  } catch {
    return undefined;
  }
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSecret() {
  if (process.env.AUTH_SESSION_SECRET) {
    return process.env.AUTH_SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is required in production.");
  }
  return "local-development-session-secret";
}
