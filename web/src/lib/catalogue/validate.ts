/** Engineering-data validation for extracted products. Errors block approval; warnings must be reviewed; info is advisory. */
import type { ExtractedProduct } from "./schema";

export interface Issue { severity: "info" | "warning" | "error"; code: string; message: string; page?: number }

const combo = (o: Record<string, string>, keys: string[]) => keys.map((k) => `${k}=${o[k] ?? ""}`).join("|");
const matches = (match: Record<string, string>, opts: Record<string, string>) => Object.entries(match).every(([k, v]) => opts[k] === v);

export function validateExtracted(p: ExtractedProduct): Issue[] {
  const out: Issue[] = [];
  const optKeys = p.options.map((o) => o.key);
  const values = new Map(p.options.map((o) => [o.key, new Set(o.values.map((v) => v.value))]));
  if (new Set(optKeys).size !== optKeys.length) out.push({ severity: "error", code: "duplicate_option", message: "An option is listed twice." });
  for (const o of p.options) if (new Set(o.values.map((v) => v.value)).size !== o.values.length) out.push({ severity: "error", code: "duplicate_value", message: `Option “${o.name_en}” lists the same value twice.` });

  // Variants: every variant uses every option, only known values, no duplicate combination.
  const seen = new Set<string>();
  p.variants.forEach((v, i) => {
    const keys = Object.keys(v.options);
    const missing = optKeys.filter((k) => !(k in v.options)); const extra = keys.filter((k) => !optKeys.includes(k));
    if (missing.length || extra.length) out.push({ severity: "error", code: "variant_options", message: `Variant ${i + 1}: ${missing.length ? `missing ${missing.join(", ")}` : ""}${extra.length ? ` unknown ${extra.join(", ")}` : ""}`.trim(), page: v.page });
    for (const [k, val] of Object.entries(v.options)) if (values.has(k) && !values.get(k)!.has(val)) out.push({ severity: "error", code: "variant_value", message: `Variant ${i + 1}: “${val}” is not a listed ${k} value.`, page: v.page });
    const c = combo(v.options, optKeys);
    if (seen.has(c)) out.push({ severity: "error", code: "duplicate_variant", message: `Variant ${i + 1} repeats an existing combination (${c}).`, page: v.page });
    seen.add(c);
  });
  if (p.options.length && !p.variants.length) out.push({ severity: "error", code: "no_variants", message: "Options are defined but no valid combinations (variants) are listed." });
  if (!p.variants.length) out.push({ severity: "warning", code: "quote_only_family", message: "No sizes/classes extracted: the product would be a quote-only family without selectable variants." });

  // Option values never used by any variant would offer customers an impossible choice.
  for (const o of p.options) for (const val of o.values) if (p.variants.length && !p.variants.some((v) => v.options[o.key] === val.value))
    out.push({ severity: "error", code: "unused_value", message: `“${val.label_en}” (${o.name_en}) is not part of any variant; remove it or add the variants the catalogue supports.` });

  // Dimension tables: columns unique, rows only use known columns and options, each row describes at least one real variant.
  p.dimension_tables.forEach((t, ti) => {
    const cols = t.columns.map((c) => c.key);
    if (new Set(cols).size !== cols.length) out.push({ severity: "error", code: "dim_columns", message: `Table “${t.title_en}”: duplicate column keys.`, page: t.page });
    for (const k of Object.keys(t.applies)) if (!optKeys.includes(k)) out.push({ severity: "error", code: "dim_applies", message: `Table “${t.title_en}”: applies to unknown option “${k}”.`, page: t.page });
    const rowKeys = new Set<string>();
    t.rows.forEach((r, ri) => {
      for (const [k, v] of Object.entries(r.match)) {
        if (!optKeys.includes(k)) out.push({ severity: "error", code: "dim_match_key", message: `Table “${t.title_en}” row ${ri + 1}: unknown option “${k}”.`, page: t.page });
        else if (!values.get(k)!.has(v)) out.push({ severity: "error", code: "dim_match_value", message: `Table “${t.title_en}” row ${ri + 1}: “${v}” is not a listed ${k}.`, page: t.page });
      }
      for (const k of Object.keys(r.values)) if (!cols.includes(k)) out.push({ severity: "error", code: "dim_value_col", message: `Table “${t.title_en}” row ${ri + 1}: value for unknown column “${k}”.`, page: t.page });
      const full = { ...t.applies, ...r.match };
      if (p.variants.length && !p.variants.some((v) => matches(full, v.options))) out.push({ severity: "warning", code: "dim_row_no_variant", message: `Table “${t.title_en}” row ${ri + 1} (${Object.values(r.match).join(" ")}) has no matching variant: the catalogue may list a size/class that is not offered, or a variant is missing.`, page: t.page });
      const rk = JSON.stringify(Object.entries(full).sort());
      if (rowKeys.has(rk)) out.push({ severity: "error", code: "dim_duplicate_row", message: `Table “${t.title_en}” row ${ri + 1} duplicates another row.`, page: t.page });
      rowKeys.add(rk);
    });
    if (ti > 40) out.push({ severity: "warning", code: "dim_many", message: "Unusually many tables." });
  });
  // Two tables must not both describe the same variant with the same column set (would show conflicting data).
  for (let a = 0; a < p.dimension_tables.length; a++) for (let b = a + 1; b < p.dimension_tables.length; b++) {
    const A = p.dimension_tables[a], B = p.dimension_tables[b];
    if (JSON.stringify(A.columns.map((c) => c.key)) !== JSON.stringify(B.columns.map((c) => c.key))) continue;
    const clash = A.rows.some((ra) => B.rows.some((rb) => { const fa = { ...A.applies, ...ra.match }, fb = { ...B.applies, ...rb.match }; return Object.keys({ ...fa, ...fb }).every((k) => fa[k] === undefined || fb[k] === undefined || fa[k] === fb[k]) && JSON.stringify(Object.entries(fa).sort()) === JSON.stringify(Object.entries(fb).sort()); }));
    if (clash) out.push({ severity: "error", code: "dim_conflict", message: `Tables “${A.title_en}” and “${B.title_en}” both describe the same variant.` });
  }

  if (!p.standards.length) out.push({ severity: "info", code: "no_standards", message: "No standard is stated for this product." });
  if (p.standards.length && !p.standards.some((s) => s.scope === "product")) out.push({ severity: "info", code: "general_standards_only", message: "Standards are only mentioned generally in the catalogue, not for this product." });
  if (!p.materials.length) out.push({ severity: "info", code: "no_materials", message: "No material is stated for this product." });
  for (const m of p.materials) if (!m.grades.length) out.push({ severity: "warning", code: "no_grades", message: `Material “${m.type}” has no explicitly listed grades; no grade option will be offered.` });
  if (!p.category_slug) out.push({ severity: "warning", code: "no_category", message: "No category chosen." });
  if (!p.name_ar) out.push({ severity: "info", code: "no_arabic", message: "No Arabic name: the Arabic page stays out of search until one is added." });
  // never blocks the import: the product gets its catalogue drawing or a labelled placeholder until a photo is uploaded
  if (!p.images.length) out.push({ severity: "info", code: "no_images", message: p.dimension_tables.some((t) => t.drawing) ? "No product picture selected — the dimensional drawing will be the temporary image." : "No image selected — a labelled placeholder is shown until you upload a photo." });
  return [...p.warnings.map((w) => ({ ...w })), ...out];
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === "error");

/** Rows of a dimension table that apply to one selected variant (the table's own applies + the row's match must both hold). */
export function rowsForVariant<T extends { match: Record<string, string> }>(applies: Record<string, string>, rows: T[], opts: Record<string, string>): T[] {
  if (!matches(applies, opts)) return [];
  return rows.filter((r) => matches(r.match, opts));
}
