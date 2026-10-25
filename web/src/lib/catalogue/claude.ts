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
