import { relayFetch } from "@/lib/relay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await relayFetch("/health");
    const j = await r.json().catch(() => ({}));
    return new Response(JSON.stringify(j), {
      status: r.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "relay_unreachable" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      },
    );
  }
}
