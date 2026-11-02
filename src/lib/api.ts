import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        code: "validation_error",
        fields: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "invalid_invitation") {
    return NextResponse.json({ error: "This invitation is invalid or has expired.", code: "invalid_invitation" }, { status: 410 });
  }
  if (message === "email_mismatch") {
    return NextResponse.json({ error: "Sign in with the email this invitation was sent to.", code: "email_mismatch" }, { status: 403 });
  }
  if (message.includes("duplicate key")) {
    return NextResponse.json({ error: "That record already exists.", code: "duplicate" }, { status: 409 });
  }
  console.error("[bloom] api error", error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", code: "server_error" },
    { status: 500 },
  );
}

/** Basic CSRF protection for state-changing requests. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // same-origin fetch may omit Origin in some browsers
  const allowed = new Set(
    [process.env.APP_URL, "http://localhost:3001", "http://127.0.0.1:3001"].filter(Boolean) as string[],
  );
  try {
    const host = new URL(origin).host;
    for (const base of allowed) {
      if (new URL(base).host === host) return;
    }
  } catch {
    // fall through
  }
  throw new ApiError("Cross-origin request rejected", 403, "csrf");
}

export function parseLimit(value: string | null, fallback = 100, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function isoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
