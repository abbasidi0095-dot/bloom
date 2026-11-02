export class ApiClientError extends Error {
  status: number;
  code: string;
  fields?: Array<{ path: string; message: string }>;
  constructor(message: string, status: number, code = "error", fields?: Array<{ path: string; message: string }>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch (error) {
    throw new ApiClientError(
      "You're offline. Your change will sync when the connection returns.",
      0,
      "offline",
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    let payload: { error?: string; code?: string; fields?: Array<{ path: string; message: string }> } = {};
    try {
      payload = await response.json();
    } catch {
      // ignore
    }
    throw new ApiClientError(
      payload.error || "Something went wrong. Please try again.",
      response.status,
      payload.code,
      payload.fields,
    );
  }
  if (contentType.includes("application/json")) return (await response.json()) as T;
  return (await response.blob()) as T;
}

export function isOfflineError(error: unknown) {
  return error instanceof ApiClientError && error.code === "offline";
}

export async function uploadImage(file: File, babyId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("babyId", babyId);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiClientError(payload.error || "Upload failed", response.status, payload.code);
  }
  return (await response.json()) as { id: string; url: string };
}
