import { NextResponse } from "next/server";

export function okJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorJson(error: unknown, status?: number) {
  const message = extractErrorMessage(error);
  return NextResponse.json({ error: message }, { status: status ?? extractErrorStatus(error) ?? 400 });
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

function extractErrorMessage(error: unknown) {
  const upstream = extractUpstreamError(error);
  if (upstream) {
    return upstream;
  }

  return error instanceof Error ? error.message : "Unknown error";
}

function extractUpstreamError(error: unknown) {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }

  const status = typeof error.response.status === "number" ? error.response.status : undefined;
  const data = sanitizeErrorData(error.response.data);
  const detail = formatErrorData(data);
  const base = status ? `Upstream CAW request failed with status ${status}` : "Upstream CAW request failed";

  return detail ? `${base}: ${detail}` : base;
}

function extractErrorStatus(error: unknown) {
  if (!isRecord(error) || typeof error.status !== "number") {
    return undefined;
  }
  const status = error.status;
  if (status >= 200 && status <= 599) {
    return status;
  }
  return undefined;
}

function sanitizeErrorData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeErrorData);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /api[_-]?key|token|secret|private|credential|authorization/i.test(key)
        ? "[redacted]"
        : sanitizeErrorData(entry)
    ])
  );
}

function formatErrorData(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
