import "server-only";
/**
 * A small, read-only MCP server (Model Context Protocol, Streamable HTTP transport, stateless JSON responses) at /mcp.
 * Tools search the public catalogue and read product pages — the same published data as the website, no writes, no login.
 * The tool list is also published in the server card (/.well-known/mcp/server-card.json).
 */
import { COMPANY, agentSearch, categoryTree, productMarkdown, type Lang } from "@/lib/agent/content";
import { abs } from "@/lib/seo";
import { getSettings, s } from "@/lib/settings";

export const SERVER_INFO = { name: "kanzcorner-catalogue", title: "KANZ CORNER product catalogue", version: "1.0.0" };
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST = "2025-06-18";
const INSTRUCTIONS = `${COMPANY.summary} ${COMPANY.pricing} Use search_products to find items, get_product for details (options, configurations, dimensions), list_categories to browse, and get_company_info for contact details and how to request a quotation. Quotations are requested by the buyer on ${abs("/en/rfq")}.`;

const langProp = { type: "string", enum: ["en", "ar"], description: "Language of names and descriptions (default en)." };
export const TOOLS = [
  { name: "search_products", title: "Search products",
    description: "Search the KANZ CORNER catalogue of pipes, fittings, flanges, valves, gaskets and fasteners by keywords (product type, size, material, standard, brand). Returns matching products with their page URL, brand and price (or 'price on request').",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Keywords, e.g. 'weld neck flange 4 inch class 150' or 'spiral wound gasket'." },
      category: { type: "string", description: "Optional category slug from list_categories, e.g. 'flanges'." }, limit: { type: "integer", minimum: 1, maximum: 50, description: "Maximum results (default 10)." }, lang: langProp },
      required: ["query"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "get_product", title: "Get product details",
    description: "Full details of one product by its slug (the last part of its URL, from search_products): brand, materials, standards, price or 'on request', options, configurations (SKUs) and dimension tables, as Markdown.",
    inputSchema: { type: "object", properties: { slug: { type: "string", description: "Product slug, e.g. 'spiral-wound-gaskets'." }, lang: langProp }, required: ["slug"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "list_categories", title: "List product categories",
    description: "All product categories and subcategories with their slugs and page URLs.",
    inputSchema: { type: "object", properties: { lang: langProp }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: "get_company_info", title: "Company, contact and quotation info",
    description: "Who KANZ CORNER is, how pricing works, contact details and how to request a quotation.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false } },
] as const;

type Json = Record<string, unknown>;
const text = (t: string, structured?: Json) => ({ content: [{ type: "text", text: t }], ...(structured ? { structuredContent: structured } : {}) });
const toolError = (t: string) => ({ content: [{ type: "text", text: t }], isError: true });
const lng = (v: unknown): Lang => (v === "ar" ? "ar" : "en");

async function callTool(name: string, a: Json) {
  switch (name) {
    case "search_products": {
      const q = typeof a.query === "string" ? a.query : ""; if (!q.trim()) return toolError("query is required.");
      const r = await agentSearch(q, { category: typeof a.category === "string" ? a.category : undefined, limit: Number(a.limit) || 10, lang: lng(a.lang) });
      const lines = r.products.map((p) => `- ${p.name}${p.brand ? ` (${p.brand})` : ""} — ${p.price} — slug: ${p.slug} — ${p.url}`);
      return text(`${r.total} product(s) match "${q}"${r.total > r.products.length ? `; showing ${r.products.length}` : ""}.\n\n${lines.join("\n") || "No matches. Try fewer or different words."}`, r as unknown as Json);
    }
    case "get_product": {
      const slug = typeof a.slug === "string" ? a.slug.trim().toLowerCase() : "";
      if (!/^[a-z0-9-]{1,200}$/.test(slug)) return toolError("A valid product slug is required (letters, digits and hyphens).");
      const md = await productMarkdown(lng(a.lang), slug);
      return md ? text(md) : toolError(`No published product with slug "${slug}". Use search_products to find one.`);
    }
    case "list_categories": {
      const lang = lng(a.lang); const tree = await categoryTree();
      const n = (c: { name_en: string; name_ar: string | null }) => (lang === "ar" && c.name_ar) || c.name_en;
      const lines = tree.flatMap((c) => [`- ${n(c)} — slug: ${c.slug} — ${abs(`/${lang}/category/${c.slug}`)}`, ...c.children.map((x) => `  - ${n(x)} — slug: ${x.slug}`)]);
      return text(lines.join("\n"), { categories: tree.map((c) => ({ slug: c.slug, name: n(c), children: c.children.map((x) => ({ slug: x.slug, name: n(x) })) })) });
    }
    case "get_company_info": {
      const st = await getSettings();
      return text([`${COMPANY.name}: ${COMPANY.summary}`, "", COMPANY.pricing, "", `Request a quotation: ${abs("/en/rfq")} (English) or ${abs("/ar/rfq")} (Arabic) — include sizes, material grades, standards and quantities; drawings or a BOQ can be attached.`,
        s(st, "company_phone") && `Phone: ${s(st, "company_phone")}`, s(st, "company_email_sales") && `Email: ${s(st, "company_email_sales")}`, s(st, "company_whatsapp") && `WhatsApp: ${s(st, "company_whatsapp")}`,
        s(st, "company_address_en") && `Address: ${s(st, "company_address_en")}`, `Website: ${abs("/en")}`].filter(Boolean).join("\n"));
    }
  }
  return null;
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message; returns null for notifications (no reply). */
export async function handleRpc(m: Rpc) {
  const isNote = m.id === undefined || m.id === null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return isNote ? null : err(m.id, -32600, "Invalid request");
  if (isNote) return null;   // notifications/initialized, notifications/cancelled, ...
  const p = m.params ?? {};
  switch (m.method) {
    case "initialize": {
      const asked = typeof p.protocolVersion === "string" ? p.protocolVersion : LATEST;
      return ok(m.id, { protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : LATEST, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case "ping": return ok(m.id, {});
    case "tools/list": return ok(m.id, { tools: TOOLS });
    case "tools/call": {
      const name = typeof p.name === "string" ? p.name : "";
      try {
        const r = await callTool(name, (p.arguments as Json) ?? {});
        return r ? ok(m.id, r) : err(m.id, -32602, `Unknown tool: ${name}`);
      } catch { return ok(m.id, toolError("The catalogue could not be read just now. Please try again.")); }
    }
    case "resources/list": return ok(m.id, { resources: [] });
    case "prompts/list": return ok(m.id, { prompts: [] });
  }
  return err(m.id, -32601, `Method not found: ${m.method}`);
}

export function serverCard() {
  const endpoint = abs("/mcp");
  return {
    name: SERVER_INFO.name, version: SERVER_INFO.version, title: SERVER_INFO.title,
    description: `Read-only access to the public product catalogue of ${COMPANY.name}: search products, read product details (configurations, dimensions, prices where published) and categories. ${COMPANY.pricing}`,
    serverInfo: SERVER_INFO, protocolVersion: LATEST, supportedProtocolVersions: PROTOCOL_VERSIONS,
    endpoint, transport: { type: "streamable-http", endpoint }, remotes: [{ type: "streamable-http", url: endpoint }],
    capabilities: { tools: { listChanged: false } }, authentication: { required: false },
    tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
    instructions: INSTRUCTIONS,
    links: { website: abs("/en"), documentation: abs("/llms.txt"), markdown: abs("/md/en") },
    iconUrl: abs("/icon.png"), contact: abs("/en/contact"),
  };
}
