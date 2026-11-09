import { serverCard } from "@/lib/agent/mcp";

export const revalidate = 3600;
/** MCP Server Card (SEP-1649 / SEP-2127, draft): describes the read-only catalogue MCP server at /mcp. */
export function GET() {
  return new Response(JSON.stringify(serverCard(), null, 2), { headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } });
}
