import { query } from "@/lib/db";

export async function GET() {
  try {
    const started = Date.now();
    await query("select 1");
    return Response.json({
      ok: true,
      service: "bloom-web",
      database: "ok",
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, service: "bloom-web", database: "error" }, { status: 503 });
  }
}
