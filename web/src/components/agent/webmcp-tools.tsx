"use client";
import * as React from "react";

/**
 * WebMCP: tools an AI agent running in the visitor's browser can call on this page. Read-only tools return the Markdown
 * versions of catalogue pages; prepare_quotation_request only fills in the RFQ form and opens it — the visitor checks and sends
 * it themselves. WebMCP is a draft browser API (exposed as document.modelContext or, in earlier builds, navigator.modelContext);
 * browsers without it ignore all of this.
 */
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
interface ModelContext { registerTool: (tool: { name: string; title?: string; description: string; inputSchema: object; annotations?: object; execute: (args: Record<string, unknown>) => Promise<ToolResult> }) => unknown; unregisterTool?: (name: string) => void }
export const RFQ_DRAFT_KEY = "kanz_rfq_draft";

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });
async function md(path: string): Promise<ToolResult> {
  const r = await fetch(path, { headers: { accept: "text/markdown" } });
  return r.ok ? text(await r.text()) : text(`Not found (${r.status}).`, true);
}

export function WebMcpTools({ lang }: { lang: "en" | "ar" }) {
  React.useEffect(() => {
    const mc = ((document as unknown as { modelContext?: ModelContext }).modelContext ?? (navigator as unknown as { modelContext?: ModelContext }).modelContext);
    if (!mc?.registerTool) return;
    const langProp = { type: "string", enum: ["en", "ar"], description: "Language (default: the page language)." };
    const L = (v: unknown) => (v === "ar" || v === "en" ? v : lang);
    const tools = [
      { name: "search_products", title: "Search products",
        description: "Search the KANZ CORNER catalogue (pipes, fittings, flanges, valves, gaskets, fasteners) by keywords such as product type, size, material, standard or brand. Returns products with links and price or 'price on request'.",
        inputSchema: { type: "object", properties: { query: { type: "string", description: "Keywords, e.g. 'weld neck flange 4 inch class 150'." }, category: { type: "string", description: "Optional category slug." }, lang: langProp }, required: ["query"] },
        annotations: { readOnlyHint: true },
        execute: async (a: Record<string, unknown>) => md(`/md/${L(a.lang)}/products?q=${encodeURIComponent(String(a.query ?? ""))}${a.category ? `&category=${encodeURIComponent(String(a.category))}` : ""}`) },
      { name: "get_product", title: "Get product details",
        description: "Details of one product by its slug (last part of its URL): brand, materials, standards, price or 'on request', options, configurations and dimensions.",
        inputSchema: { type: "object", properties: { slug: { type: "string", description: "Product slug, e.g. 'spiral-wound-gaskets'." }, lang: langProp }, required: ["slug"] },
        annotations: { readOnlyHint: true },
        execute: async (a: Record<string, unknown>) => { const slug = String(a.slug ?? "").toLowerCase(); return /^[a-z0-9-]{1,200}$/.test(slug) ? md(`/md/${L(a.lang)}/product/${slug}`) : text("A valid product slug is required.", true); } },
      { name: "list_categories", title: "List product categories",
        description: "Overview of the shop: product categories with links, featured products, pricing and how to request a quotation.",
        inputSchema: { type: "object", properties: { lang: langProp } }, annotations: { readOnlyHint: true },
        execute: async (a: Record<string, unknown>) => md(`/md/${L(a.lang)}`) },
      { name: "prepare_quotation_request", title: "Prepare a quotation request",
        description: "Fill in the request-for-quotation form with the items the user needs and open it. Nothing is sent: the user reviews the form, adds their contact details and submits it themselves.",
        inputSchema: { type: "object", properties: {
          items: { type: "array", minItems: 1, maxItems: 50, description: "Items to quote.", items: { type: "object", properties: {
            description: { type: "string", description: "What is needed, e.g. 'Weld neck flange'." }, specification: { type: "string", description: "Size / grade / schedule / standard, e.g. '4\" class 150 ASTM A105 ASME B16.5'." },
            quantity: { type: "number", minimum: 0.01 }, unit: { type: "string", description: "pcs, m, kg, set… (default pcs)" } }, required: ["description", "quantity"] } },
          lang: langProp }, required: ["items"] },
        execute: async (a: Record<string, unknown>) => {
          const items = (Array.isArray(a.items) ? a.items : []).slice(0, 50).map((x) => x as Record<string, unknown>)
            .map((x) => ({ description: String(x.description ?? "").slice(0, 300), specification: String(x.specification ?? "").slice(0, 300), quantity: String(Number(x.quantity) > 0 ? Number(x.quantity) : 1), unit: String(x.unit || "pcs").slice(0, 20) }))
            .filter((x) => x.description.trim());
          if (!items.length) return text("At least one item with a description is required.", true);
          try { sessionStorage.setItem(RFQ_DRAFT_KEY, JSON.stringify(items)); } catch { return text("The form could not be prepared in this browser.", true); }
          window.location.assign(`/${L(a.lang)}/rfq`);
          return text(`The quotation form is open with ${items.length} item(s). The user now adds their contact details, reviews the items and presses Submit; nothing has been sent yet.`);
        } },
    ];
    const done: string[] = [];
    for (const t of tools) { try { mc.registerTool(t); done.push(t.name); } catch { /* already registered or unsupported */ } }
    return () => { for (const n of done) { try { mc.unregisterTool?.(n); } catch { /* ignore */ } } };
  }, [lang]);
  return null;
}
