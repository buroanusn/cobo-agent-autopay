import { NextResponse } from "next/server";

export function okJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorJson(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}
