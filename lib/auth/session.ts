// Session cookie HMAC built on the Web Crypto API (globalThis.crypto.subtle,
// available in Node 19+). Avoids importing `node:crypto`, which webpack 5
// cannot handle when bundling this module for the Next.js server bundle
// (throws "UnhandledSchemeError: Reading from node:crypto is not handled").
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

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

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
  const value = await signPayload({
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

async function getSessionPayload(): Promise<SessionPayload | undefined> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) {
    return undefined;
  }

  const payload = await verifyPayload(value);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) {
    return undefined;
  }
  return payload;
}

async function signPayload(payload: SessionPayload): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSha256(sessionSecret(), encoded);
  return `${encoded}.${toBase64Url(sig)}`;
}

async function verifyPayload(value: string): Promise<SessionPayload | undefined> {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return undefined;

  const expected = await hmacSha256(sessionSecret(), encoded);
  const provided = fromBase64Url(signature);
  if (!timingSafeEqualBytes(expected, provided)) return undefined;

  try {
    const decoded = new TextDecoder().decode(fromBase64Url(encoded));
    const parsed = JSON.parse(decoded) as Partial<SessionPayload>;
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

function sessionSecret() {
  if (process.env.AUTH_SESSION_SECRET) {
    return process.env.AUTH_SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET is required in production.");
  }
  return "local-development-session-secret";
}
