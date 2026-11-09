import "server-only";
/**
 * Plain-text views of the public catalogue for AI agents: Markdown pages (/md/...), llms.txt, the MCP server (/mcp) and
 * the in-browser WebMCP tools all read from here, so they say the same thing as the website.
 * Only published data, the same as the storefront. Prices appear only where the shop has set a real price; everything else
 * is "price on request" (quotation) — nothing is estimated.
 */
import { buildTree, getBrandBySlug, getCategories, getCategoryBySlug, getFamilyBySlug, getFlagged, getProductBySlug, searchProducts, type CategoryNode } from "@/lib/queries/catalog";
import { getSettings, s } from "@/lib/settings";
import { cardPrice, type ProductCard } from "@/lib/types";
import { abs } from "@/lib/seo";

export type Lang = "en" | "ar";
const nm = (o: { name_en: string; name_ar?: string | null }, lang: Lang) => (lang === "ar" && o.name_ar) || o.name_en;
const txt = (o: Record<string, unknown>, field: string, lang: Lang) => ((lang === "ar" && (o[`${field}_ar`] as string | null)) || (o[`${field}_en`] as string | null) || "").trim();
const esc = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const sar = (n: number) => `SAR ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (ex. VAT)`;

export const COMPANY = {
  name: "KANZ CORNER EST.",
  summary: "Saudi B2B supplier of industrial piping products — pipes, pipe fittings, forged fittings, flanges, valves, fasteners, gaskets and related items — based in Al Khobar, Eastern Province, serving contractors, fabricators and plants across Saudi Arabia.",
  pricing: "Most items are supplied against a request for quotation (RFQ): prices depend on size, material grade, standard and quantity. Where the website shows a price, it is in Saudi riyals excluding 15% VAT. Items without a price are quoted on request.",
};

export interface ProductSummary { name: string; url: string; slug: string; brand: string | null; category: string | null; price: string; description: string }
export function summarise(p: ProductCard, lang: Lang): ProductSummary {
  const slug = p.family?.slug ?? p.slug; const price = p.family ? p.family.price : cardPrice(p);
  return {
    name: p.family ? nm(p.family, lang) : nm(p, lang), slug, url: abs(`/${lang}/product/${slug}`),
    brand: p.family ? p.family.brands.map((b) => b.name).join(", ") || null : p.brands?.name ?? null,
    category: p.categories?.slug ?? null, price: price != null ? `from ${sar(Number(price))}` : "price on request (quotation)",
    description: txt(p as unknown as Record<string, unknown>, "short_desc", lang),
  };
}

export async function agentSearch(q: string, opts: { category?: string; limit?: number; lang?: Lang } = {}) {
  const lang = opts.lang ?? "en";
  const r = await searchProducts({ q: q.trim().slice(0, 120) || undefined, category: opts.category || undefined, pageSize: Math.min(Math.max(opts.limit ?? 10, 1), 50), sort: q ? "relevance" : "newest" });
  return { total: r.total, products: r.products.map((p) => summarise(p, lang)) };
}

export async function categoryTree(): Promise<CategoryNode[]> { return buildTree(await getCategories()); }

async function contactLines() {
  const st = await getSettings();
  return [s(st, "company_phone") && `- Phone: ${s(st, "company_phone")}`, s(st, "company_email_sales") && `- Email: ${s(st, "company_email_sales")}`,
    s(st, "company_whatsapp") && `- WhatsApp: ${s(st, "company_whatsapp")}`, s(st, "company_address_en") && `- Address: ${s(st, "company_address_en")}`].filter(Boolean) as string[];
}

const productLine = (p: ProductSummary) => `- [${p.name}](${p.url})${p.brand ? ` — ${p.brand}` : ""} — ${p.price}${p.description ? `. ${p.description}` : ""}`;

// ───────── Markdown pages ─────────
export async function homeMarkdown(lang: Lang) {
  const [tree, featured, contact] = await Promise.all([categoryTree(), getFlagged("featured", 12), contactLines()]);
  return [
    `# ${COMPANY.name}`, "", `> ${COMPANY.summary}`, "", "## Pricing", "", COMPANY.pricing, "",
    "## Product categories", "", ...tree.map((c) => `- [${nm(c, lang)}](${abs(`/${lang}/category/${c.slug}`)})${c.children.length ? `: ${c.children.map((x) => nm(x, lang)).join(", ")}` : ""}`), "",
    ...(featured.length ? ["## Featured products", "", ...featured.map((p) => productLine(summarise(p, lang))), ""] : []),
    "## Request a quotation", "", `Send sizes, material grades, standards and quantities through the RFQ form: ${abs(`/${lang}/rfq`)} (drawings and BOQs can be attached). Search the catalogue: ${abs(`/${lang}/products?q=`)}<words>.`, "",
    "## Contact", "", ...contact, `- Contact page: ${abs(`/${lang}/contact`)}`, "",
    "## For agents", "", `- Site summary: ${abs("/llms.txt")}`, `- MCP server: ${abs("/mcp")} (card: ${abs("/.well-known/mcp/server-card.json")})`, `- Any page as Markdown: request it with \`Accept: text/markdown\`, or prefix the path with /md (e.g. ${abs(`/md/${lang}/products?q=flange`)}).`, "",
  ].join("\n");
}

export async function listingMarkdown(lang: Lang, o: { q?: string; category?: string; page?: number }) {
  const cat = o.category ? await getCategoryBySlug(o.category) : null;
  const pageSize = 50; const page = Math.max(1, o.page ?? 1);
  const r = await searchProducts({ q: o.q || undefined, category: o.category || undefined, pageSize, page, sort: o.q ? "relevance" : "newest" });
  const tree = cat ? (await categoryTree()).flatMap(function walk(n): CategoryNode[] { return [n, ...n.children.flatMap(walk)]; }).find((n) => n.id === cat.id) : undefined;
  const title = cat ? nm(cat, lang) : o.q ? `Search: ${o.q}` : "All products";
  const htmlPath = cat ? `/${lang}/category/${cat.slug}` : `/${lang}/products${o.q ? `?q=${encodeURIComponent(o.q)}` : ""}`;
  const more = r.total > page * pageSize;
  return [
    `# ${title}`, "", `Web page: ${abs(htmlPath)}`, "",
    ...(cat ? [txt(cat as unknown as Record<string, unknown>, "description", lang), ""].filter((x, i) => i || x) : []),
    ...(tree?.children.length ? ["## Subcategories", "", ...tree.children.map((c) => `- [${nm(c, lang)}](${abs(`/md/${lang}/category/${c.slug}`)})`), ""] : []),
    `## Products (${r.total})`, "", ...(r.products.length ? r.products.map((p) => productLine(summarise(p, lang))) : ["No products match."]), "",
    ...(more ? [`Next page: ${abs(`/md${htmlPath}${htmlPath.includes("?") ? "&" : "?"}page=${page + 1}`)}`, ""] : []),
    COMPANY.pricing, `Request a quotation: ${abs(`/${lang}/rfq`)}`, "",
  ].join("\n");
}

export async function brandMarkdown(lang: Lang, slug: string) {
  const b = await getBrandBySlug(slug); if (!b) return null;
  return [`# ${lang === "ar" && b.name_ar ? b.name_ar : b.name}`, "", `Web page: ${abs(`/${lang}/brand/${b.slug}`)}`, "", `Products by this brand: ${abs(`/${lang}/products`)} (filter by brand on the web page).`, "", COMPANY.pricing, ""].join("\n");
}

export async function productMarkdown(lang: Lang, slug: string, maxRows = 40): Promise<string | null> {
  const d = await getProductBySlug(slug);
  if (!d) {
    const f = await getFamilyBySlug(slug); if (!f) return null;
    const fam = f.family as unknown as Record<string, unknown>;
    return [`# ${nm(f.family, lang)}`, "", `Web page: ${abs(`/${lang}/product/${slug}`)}`, "", txt(fam, "short_desc", lang), txt(fam, "description", lang), "",
      "## Manufacturers offered", "", ...f.offerings.map((o) => `- ${o.brand?.name ?? "Manufacturer not named"} — ${o.variants.length} configurations — [details](${abs(`/md/${lang}/product/${o.product.slug}`)})`), "",
      COMPANY.pricing, `Request a quotation: ${abs(`/${lang}/rfq`)}`, ""].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  }
  const p = d.product as unknown as Record<string, unknown> & { slug: string; specs?: { standards?: { code: string; scope?: string }[]; notes?: string[] } | null; is_quote_only: boolean; base_price: number | null; sku: string | null };
  const prices = d.variants.filter((v) => v.price != null).map((v) => Number(v.price)); if (p.base_price != null) prices.push(Number(p.base_price));
  const price = p.is_quote_only || !prices.length ? "Price on request — request a quotation." : `From ${sar(Math.min(...prices))}${prices.length > 1 ? ` to ${sar(Math.max(...prices))}` : ""}.`;
  const lab = Object.fromEntries(d.options.map((o) => [o.key, Object.fromEntries(o.values.map((v) => [v.value, (lang === "ar" && v.label_ar) || v.label_en]))]));
  const vLabel = (opts?: Record<string, string>) => d.options.map((o) => lab[o.key]?.[opts?.[o.key] ?? ""]).filter((x) => x && x !== "N/A").join(" · ");
  const rows = d.variants.slice(0, maxRows);
  const out = [
    `# ${nm(d.product, lang)}`, "", `Web page: ${abs(`/${lang}/product/${p.slug}`)}`, "",
    ...[d.brand && `- Brand: ${d.brand.name}`, d.category && `- Category: ${nm(d.category, lang)}`, p.sku && `- SKU: ${p.sku}`,
      d.materials.length && `- Materials: ${d.materials.map((m) => `${nm(m, lang)}${m.grades.length ? ` (${m.grades.join(", ")})` : ""}`).join("; ")}`,
      p.specs?.standards?.length && `- Standards: ${p.specs.standards.map((x) => x.code).join(", ")}`, `- Price: ${price}`].filter(Boolean) as string[], "",
    txt(p, "short_desc", lang), "", txt(p, "description", lang), "",
    ...(d.options.length ? ["## Options", "", ...d.options.map((o) => `- ${(lang === "ar" && o.name_ar) || o.name_en}: ${o.values.filter((v) => v.value !== "na").map((v) => (lang === "ar" && v.label_ar) || v.label_en).join(", ")}`), ""] : []),
    ...(rows.length ? [`## Configurations (${d.variants.length})`, "", "| SKU | Configuration | Price |", "|---|---|---|",
      ...rows.map((v) => `| ${esc(v.sku)} | ${esc(vLabel(v.options) || [v.size, v.grade, v.schedule, v.pressure_class].filter(Boolean).join(" / ") || (lang === "ar" && v.label_ar) || v.label_en || "—")} | ${v.price != null && !p.is_quote_only ? esc(sar(Number(v.price))) : "on request"} |`),
      ...(d.variants.length > rows.length ? ["", `${d.variants.length - rows.length} more configurations on the web page.`] : []), ""] : []),
    ...d.dimensionTables.slice(0, 3).flatMap((t) => {
      const keys = [...new Set(t.rows.flatMap((r) => Object.keys(r.match)))];
      return [`## Dimensions: ${(lang === "ar" && t.title_ar) || t.title_en}`, "",
        `| ${[...keys, ...t.columns.map((c) => `${c.symbol ?? c.label_en}${c.unit ? ` (${c.unit})` : ""}`)].map(esc).join(" | ")} |`, `|${[...keys, ...t.columns].map(() => "---").join("|")}|`,
        ...t.rows.slice(0, maxRows).map((r) => `| ${[...keys.map((k) => lab[k]?.[r.match[k]] ?? r.match[k] ?? "—"), ...t.columns.map((c) => r.values[c.key] ?? "—")].map(esc).join(" | ")} |`),
        ...(t.rows.length > maxRows ? ["", `Full table (${t.rows.length} rows): ${abs(`/api/product/${p.slug}/dimensions`)} or the datasheet ${abs(`/api/datasheet/${p.slug}`)}`] : []), ""];
    }),
    ...(d.documents.length ? ["## Documents", "", `- Datasheet (PDF): ${abs(`/api/datasheet/${p.slug}`)}`, ""] : [`Datasheet (PDF): ${abs(`/api/datasheet/${p.slug}`)}`, ""]),
    `Request a quotation for this product: ${abs(`/${lang}/rfq`)}`, "",
  ];
  return out.filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
}

// ───────── llms.txt ─────────
export async function llmsTxt() {
  const [tree, contact] = await Promise.all([categoryTree(), contactLines()]);
  return [
    `# ${COMPANY.name}`, "", `> ${COMPANY.summary}`, "", COMPANY.pricing, "",
    "The site is bilingual: English pages under /en, Arabic under /ar. Every catalogue page is also available as Markdown — send `Accept: text/markdown`, or prefix the path with /md.", "",
    "## Key pages", "",
    `- [Home](${abs("/en")}): overview, featured products, how to request a quotation (Markdown: ${abs("/md/en")})`,
    `- [All products](${abs("/en/products")}): searchable catalogue, \`?q=\` for keywords (Markdown: ${abs("/md/en/products")})`,
    `- [Request for quotation](${abs("/en/rfq")}): send sizes, grades, standards and quantities; attach drawings or a BOQ`,
    `- [Quality & certifications](${abs("/en/quality")}): approvals and certificates`,
    `- [About](${abs("/en/about")}) and [Contact](${abs("/en/contact")})`, "",
    "## Product categories", "", ...tree.map((c) => `- [${c.name_en}](${abs(`/en/category/${c.slug}`)}): ${c.children.length ? c.children.map((x) => x.name_en).join(", ") : "see the category page"}`), "",
    "## For agents", "",
    `- [MCP server](${abs("/mcp")}): read-only tools to search products, read a product and list categories (Streamable HTTP; card at ${abs("/.well-known/mcp/server-card.json")})`,
    `- [Sitemap](${abs("/sitemap.xml")})`, `- Product datasheets (PDF): /api/datasheet/<product-slug>`, "",
    "## Contact", "", ...contact, "",
  ].join("\n");
}
