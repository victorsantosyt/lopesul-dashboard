export const dynamic = "force-dynamic";

export async function GET() {
  const body = JSON.stringify({ ok: true, app: "backend", ts: Date.now() });
  return new Response(body, {
    headers: { "content-type": "application/json" },
  });
}
