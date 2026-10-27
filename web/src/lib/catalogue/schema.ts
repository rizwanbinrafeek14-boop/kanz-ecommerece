/**
 * The interchange format for one extracted product family (one manufacturer × one product type).
 * Produced by the Claude vision extractor or by a hand-checked extraction file, validated here, stored in extracted_products.data,
 * edited in the review screen and finally imported. Every value must come from the catalogue; nothing is inferred.
 */
import { z } from "zod";

const str = (n: number) => z.string().trim().min(1).max(n);
const optStr = (n: number) => z.string().trim().max(n).nullish();
const page = z.number().int().min(1).max(2000);
const key = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Option keys are lowercase letters, digits and _");
/** Option values keyed by option key, e.g. {"connection":"socket_weld","class":"3000","size":"1/2"}. */
const optionMap = z.record(key, str(80));

export const OptionValueSchema = z.object({ value: str(80), label_en: str(120), label_ar: optStr(120) });
export const OptionSchema = z.object({ key, name_en: str(80), name_ar: optStr(80), values: z.array(OptionValueSchema).min(1).max(300) });
export const VariantSchema = z.object({
  options: optionMap,
  manufacturer_code: optStr(80),
  weight_kg: z.number().nonnegative().max(100000).nullish(),   // only when printed in the catalogue
  page: page.optional(),
});
export const ColumnSchema = z.object({
  key: z.string().trim().min(1).max(24),       // unique within the table, usually the drawing symbol (A, B, C…) or a fixed name
  symbol: optStr(24),                           // symbol exactly as printed on the drawing
  label_en: str(120), label_ar: optStr(120),
  unit: optStr(24),                             // "mm", "in", "kg"… exactly as printed
});
export const DimensionTableSchema = z.object({
  title_en: str(200), title_ar: optStr(200),
  columns: z.array(ColumnSchema).min(1).max(40),
  applies: optionMap.default({}),               // which variants the table is for, e.g. {"connection":"socket_weld"}
  rows: z.array(z.object({ match: optionMap, values: z.record(z.string(), z.string().max(40)) })).min(1).max(500),
  notes: z.array(z.string().trim().max(1000)).max(30).default([]),   // footnotes and restrictions, verbatim
  page,
  drawing: z.object({ page, bbox: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]) }).nullish(),
});
const bbox = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]);   // x0,y0,x1,y1 as fractions of the page
const httpUrl = z.string().trim().max(2000).url().refine((u) => /^https?:\/\//i.test(u), "Only http(s) links");
/** A picture of the product: cropped from a catalogue page (page + bbox) or, for a manufacturer website, its image URL. */
export const ImageSchema = z.object({
  page: page.optional(), bbox: bbox.optional(), url: httpUrl.optional(),
  kind: z.enum(["photo", "drawing"]),
  alt_en: str(200), alt_ar: optStr(200),
}).refine((i) => !!i.url || (i.page !== undefined && !!i.bbox), "An image needs a page and crop box, or a URL");
/** A manufacturer document for the product (datasheet, drawing, certificate, catalogue PDF) — only links found on the source. */
export const DocumentSchema = z.object({ url: httpUrl, title: str(200), kind: z.enum(["datasheet", "drawing", "certificate", "catalogue", "manual", "other"]).default("datasheet") });
/** A specification row exactly as published (e.g. "Working pressure" | "PN16"), for values that are not selectable options. */
export const PropertySchema = z.object({ label_en: str(120), value_en: str(500), label_ar: optStr(120), value_ar: optStr(500) });
export const ExtractedProductSchema = z.object({
  manufacturer: str(120),
  family: z.object({ key: z.string().regex(/^[a-z0-9-]{2,80}$/), name_en: str(120), name_ar: optStr(120), type: z.string().trim().max(60).nullish() }),
  name_en: str(200), name_ar: optStr(200),
  category_slug: optStr(80),
  manufacturer_ref: optStr(120),
  short_en: optStr(500), description_en: optStr(5000), short_ar: optStr(500), description_ar: optStr(5000),
  applications_en: z.array(z.string().trim().max(300)).max(20).default([]),
  country: optStr(80),
  standards: z.array(z.object({ code: str(120), scope: z.enum(["product", "general"]), note: optStr(300), page: page.optional() })).max(30).default([]),
  materials: z.array(z.object({ type: str(120), grades: z.array(str(80)).max(60).default([]), note: optStr(300), page: page.optional() })).max(30).default([]),
  options: z.array(OptionSchema).max(10).default([]),
  variants: z.array(VariantSchema).max(5000).default([]),
  dimension_tables: z.array(DimensionTableSchema).max(40).default([]),
  images: z.array(ImageSchema).max(20).default([]),
  properties: z.array(PropertySchema).max(60).default([]),
  documents: z.array(DocumentSchema).max(30).default([]),
  /** website sources: the product page, and the identity used to find the product again on a later import (page URL + model) */
  source_url: httpUrl.nullish(),
  source_key: z.string().trim().max(2100).nullish(),
  retrieved_at: z.string().max(40).nullish(),
  notes: z.array(z.string().trim().max(1000)).max(40).default([]),
  warnings: z.array(z.object({ severity: z.enum(["info", "warning", "error"]), code: str(60), message: str(1000), page: page.optional() })).max(100).default([]),
  pages: z.array(page).max(200).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
}).refine((p) => p.pages.length > 0 || !!p.source_url, { message: "A product needs its catalogue page(s) or its source URL", path: ["pages"] });
export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;
export type DimensionTable = z.infer<typeof DimensionTableSchema>;

/** A whole extraction file: one catalogue, many products, plus per-page notes (skipped pages and why). */
export const ExtractionFileSchema = z.object({
  format: z.literal("kanz-catalogue-extraction/1"),
  manufacturer: str(120),
  source_title: str(200),
  page_count: z.number().int().min(1).max(2000).nullish(),   // PDF catalogues; null for a website extraction
  pages: z.array(z.object({ page, status: z.enum(["extracted", "needs_review", "skipped"]), note: optStr(1000), method: z.enum(["text", "vision", "manual"]).default("manual") })).default([]),
  products: z.array(ExtractedProductSchema).max(1000),
});
export type ExtractionFile = z.infer<typeof ExtractionFileSchema>;
