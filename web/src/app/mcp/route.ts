import { handleRpc } from "@/lib/agent/mcp";

export const dynamic = "force-dynamic";
/**
 * MCP endpoint (Streamable HTTP, stateless): POST a JSON-RPC message (or a batch) and get JSON back. Read-only public data,
 * so any origin may call it. GET (server-initiated event stream) is not offered.
 */
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id", "access-control-expose-headers": "mcp-protocol-version" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 64_000) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
  let msg: unknown;
  try { msg = JSON.parse(raw); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  if (Array.isArray(msg)) {
    if (!msg.length || msg.length > 20) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid batch" } }, 400);
    const out = (await Promise.all(msg.map((m) => handleRpc(m)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await handleRpc(msg as Parameters<typeof handleRpc>[0]);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
}
export function GET() { return new Response("This MCP server answers POST requests (Streamable HTTP, JSON responses). See /.well-known/mcp/server-card.json", { status: 405, headers: { allow: "POST, OPTIONS", ...CORS } }); }
export function DELETE() { return new Response(null, { status: 405, headers: { allow: "POST, OPTIONS", ...CORS } }); }
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }
