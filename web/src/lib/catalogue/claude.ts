import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ExtractedProductSchema, type ExtractedProduct } from "./schema";

export const CLAUDE_MODEL = "claude-opus-5-5";
export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const PageResultSchema = z.object({
  page_status: z.enum(["extracted", "needs_review", "skipped"]),
  page_note: z.string().max(2000).nullish(),
  products: z.array(z.unknown()).max(80),
});

const SYSTEM = `You extract product data from one page of an industrial piping manufacturer's catalogue (fittings, flanges, valves, pipes) for an e-commerce catalogue import that a human engineer will review.
Rules — technical accuracy matters more than completeness:
- Only record what is printed on THIS page. Never infer, complete, convert or "fix" sizes, classes, grades, dimensions or weights. Keep the original units and the drawing symbols exactly as printed (A, B, C… mean different things on different drawings).
- A dimension table row describes the options it is printed for. Put the pressure class, connection or schedule the table is for into "applies" or into each row's "match"; never copy a value into a size/class it is not printed for.
- Standards: scope "product" only when the page ties the standard to this product; otherwise "general".
- Materials/grades: only when explicitly listed for this product. Generic phrases like "all grades" are not grades: add an info warning instead.
- If anything is unreadable, ambiguous or seems inconsistent, keep the readable part and add a warning (severity "warning", with the page number). Skip marketing pages (company history, photos without data) with page_status "skipped" and a note.
- Use stable option keys: "connection" (values threaded, socket_weld, butt_weld), "class" (values like "3000"), "size" (values exactly as printed, e.g. "1/2", "1-1/4", "1/2x3/8"), "schedule", "radius" (long, short), "material", "grade". Values are short identifiers; labels are the display text.
- family.key is a lowercase slug of the product type without the manufacturer (e.g. "forged-elbow-90", "bw-tee-reducing", "weldolet"), so the same product on another page merges.
- bbox values are fractions (0–1) of the page width/height: x0,y0,x1,y1. Give them for each product photo and drawing you can isolate cleanly; otherwise omit.
Respond with ONLY a JSON object: {"page_status": "...", "page_note": "...", "products": [ExtractedProduct, ...]} where ExtractedProduct has:
{"manufacturer","family":{"key","name_en","type"},"name_en","category_slug"?,"manufacturer_ref"?,"standards":[{"code","scope","page"}],"materials":[{"type","grades":[],"page"}],
 "options":[{"key","name_en","values":[{"value","label_en"}]}],"variants":[{"options":{key:value},"manufacturer_code"?,"weight_kg"?,"page"}],
 "dimension_tables":[{"title_en","columns":[{"key","symbol","label_en","unit"}],"applies":{},"rows":[{"match":{},"values":{column_key:"value as printed"}}],"notes":[],"page"}],
 "images":[{"page","bbox":[x0,y0,x1,y1],"kind":"photo"|"drawing","alt_en"}],"notes":[],"warnings":[{"severity","code","message","page"}],"pages":[page],"confidence":0..1}`;

export interface PageExtraction { status: "extracted" | "needs_review" | "skipped"; note: string | null; products: ExtractedProduct[]; invalid: { index: number; error: string }[]; usage: { input: number; output: number } }

/** Sends one rendered page (PNG) plus its text layer to Claude and validates the JSON it returns. */
export async function extractPage(opts: { image: Buffer; text: string; page: number; manufacturer: string; sourceTitle: string; knownFamilies: string[] }): Promise<PageExtraction> {
  const client = new Anthropic();
  const msg = await client.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: opts.image.toString("base64") } },
        { type: "text", text: `Manufacturer: ${opts.manufacturer}\nCatalogue: ${opts.sourceTitle}\nPage: ${opts.page}\nProduct families already found in this catalogue (reuse the key if this page continues one): ${opts.knownFamilies.join(", ") || "none"}\n\nText layer of the page (may be empty, garbled or incomplete; the image is authoritative):\n${opts.text.slice(0, 20000)}` },
      ],
    }],
  }).finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined to process this page.");
  if (msg.stop_reason === "max_tokens") throw new Error("The page produced more data than one response can hold; split it or enter it manually.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let raw: unknown; try { raw = JSON.parse(json); } catch { throw new Error("The response was not valid JSON. Retry the page."); }
  const page = PageResultSchema.parse(raw);
  const products: ExtractedProduct[] = []; const invalid: { index: number; error: string }[] = [];
  page.products.forEach((p, i) => { const r = ExtractedProductSchema.safeParse(p); if (r.success) products.push(r.data); else invalid.push({ index: i, error: r.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") }); });
  return { status: page.page_status, note: page.page_note ?? null, products, invalid, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } };
}

// ───────── Manufacturer website pages ─────────
const WebResultSchema = z.object({
  page_type: z.enum(["product", "listing", "other"]),
  page_note: z.string().max(2000).nullish(),
  products: z.array(z.unknown()).max(40),
});

const WEB_SYSTEM = `You extract product data from ONE page of an industrial valve / piping manufacturer's public website, for an e-commerce catalogue import that an engineer reviews before anything is published.
Rules — technical accuracy matters more than completeness:
- Classify the page: "product" (a page about one product / model or a small series with its own data), "listing" (category or search listing, pagination, overview that only links to products), "other" (news, company, contact …). Only "product" pages return products; listings and others return "products": [].
- One product per distinct model / figure number on the page. manufacturer_ref = the model or figure number exactly as written (e.g. "GALA 2121", "Fig. 2101"). Never invent one; if none is printed leave it out and add a warning (code "needs_verification").
- Only record what the page states. Never infer, complete, convert or "fix" sizes, pressure ratings, materials, temperatures, standards or approvals. Keep original units and wording ("DN50 – DN600", "PN10/16", "-10°C to +80°C").
- Selectable options / variants: create a "size" option with one variant per size ONLY when the page lists the individual sizes for that model. Add "pressure" or "connection" as options ONLY when the page states which sizes have which rating / connection; otherwise do NOT combine them — put them into "properties" instead. A size range ("DN50–DN600") without the individual sizes is a property, not variants. Never create combinations the page does not state.
- "properties": specification rows exactly as published, with these labels where the information exists: "Valve type", "Model / figure", "Body material", "Disc material", "Seat material", "Seal material", "Stem material", "Size range", "Pressure rating", "Connection / end type", "Face-to-face", "Flange drilling", "Operating temperature", "Operating pressure", "Media", "Operation", "Standards", "Approvals / certifications", "Applications". Other published rows keep their own label. Values verbatim.
- "materials": one entry per component that has a stated material: {"type": material name as written, "grades": [grades exactly as written], "note": component ("body", "disc", "seat", "stem" …)}.
- "standards": codes exactly as written with scope "product" when the page ties them to this product.
- Approvals / certifications (UL, FM, WRAS, CE …) only as written, in properties; never claim them otherwise.
- "images": only URLs from the IMAGES list that clearly show this product (photo) or its drawing; never logos, banners, icons or other products. kind "photo" or "drawing". alt_en describes what the image shows.
- "documents": only URLs from the DOCUMENT LINKS list that belong to this product (datasheet, drawing, certificate, manual, catalogue). Keep the link text as the title.
- "dimension_tables": only when the page has a real dimensions table; columns with symbols and units as printed, each row matched to the option values it is printed for.
- family.key: lowercase slug of the product type without the manufacturer and without the model, e.g. "butterfly-valve-wafer", "gate-valve-resilient-seat", "check-valve-swing", "y-strainer". Models of the same type share the key. family.type: short type, e.g. "butterfly_valve".
- category_slug: choose from the given category list only when it clearly fits; otherwise omit.
- Missing or unclear values: leave them out and add a warning {"severity":"warning","code":"needs_verification","message":"…"}.
Respond with ONLY a JSON object: {"page_type": "...", "page_note": "...", "products": [ExtractedProduct, ...]} where ExtractedProduct has:
{"manufacturer","family":{"key","name_en","type"},"name_en","category_slug"?,"manufacturer_ref"?,"short_en"?,"description_en"?,"applications_en":[],"standards":[{"code","scope"}],"materials":[{"type","grades":[],"note"}],
 "options":[{"key","name_en","values":[{"value","label_en"}]}],"variants":[{"options":{key:value},"manufacturer_code"?}],
 "dimension_tables":[{"title_en","columns":[{"key","symbol","label_en","unit"}],"applies":{},"rows":[{"match":{},"values":{column_key:"value as printed"}}],"notes":[],"page":1}],
 "properties":[{"label_en","value_en"}],"images":[{"url","kind","alt_en"}],"documents":[{"url","title","kind"}],"notes":[],"warnings":[{"severity","code","message"}],"confidence":0..1}`;

export interface WebExtraction { pageType: "product" | "listing" | "other"; note: string | null; products: ExtractedProduct[]; invalid: { index: number; error: string }[]; usage: { input: number; output: number } }

/** Extracts the products of one cleaned manufacturer web page; image and document URLs are limited to those found on the page. */
export async function extractWebPage(opts: { input: string; url: string; manufacturer: string; knownFamilies: string[]; categories: string[]; allowedImages: Set<string>; allowedDocs: Set<string> }): Promise<WebExtraction> {
  const client = new Anthropic();
  const msg = await client.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high" },
    system: [{ type: "text", text: WEB_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Manufacturer: ${opts.manufacturer}\nProduct families already found on this site (reuse the key for the same product type): ${opts.knownFamilies.join(", ") || "none"}\nCategories: ${opts.categories.join(", ")}\n\n${opts.input}` }],
  }).finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined to process this page.");
  if (msg.stop_reason === "max_tokens") throw new Error("The page produced more data than one response can hold; review it manually.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  let raw: unknown; try { raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { throw new Error("The response was not valid JSON. Retry the page."); }
  const page = WebResultSchema.parse(raw);
  const products: ExtractedProduct[] = []; const invalid: { index: number; error: string }[] = [];
  const retrieved = new Date().toISOString().slice(0, 10);
  page.products.forEach((p, i) => {
    const r = ExtractedProductSchema.safeParse({ ...(p as object), manufacturer: opts.manufacturer, source_url: opts.url, retrieved_at: retrieved, pages: [] });
    if (!r.success) { invalid.push({ index: i, error: r.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") }); return; }
    const d = r.data;
    // links must come from the page itself: anything else is dropped and reported
    const badImg = d.images.filter((im) => !im.url || !opts.allowedImages.has(im.url)); const badDoc = d.documents.filter((x) => !opts.allowedDocs.has(x.url));
    d.images = d.images.filter((im) => im.url && opts.allowedImages.has(im.url)); d.documents = d.documents.filter((x) => opts.allowedDocs.has(x.url));
    if (badImg.length || badDoc.length) d.warnings.push({ severity: "warning", code: "unlisted_link", message: `${badImg.length + badDoc.length} image/document link(s) not found on the page were removed.` });
    products.push(d);
  });
  return { pageType: page.page_type, note: page.page_note ?? null, products, invalid, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } };
}
