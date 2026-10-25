/** Turns an approved ExtractedProduct into the payload for catalogue_import_product(): labels, SKUs, descriptions from real data only. */
import type { ExtractedProduct } from "./schema";

const OPTION_AR: Record<string, string> = { connection: "نوع التوصيل", class: "فئة الضغط", pressure_class: "فئة الضغط", size: "المقاس", material: "المادة", grade: "الدرجة", schedule: "السماكة (Schedule)", radius: "نصف القطر", end: "نوع الطرف", type: "النوع", angle: "الزاوية" };
const VALUE_AR: Record<string, string> = { threaded: "مسنّن (NPT)", socket_weld: "لحام مقبس (Socket Weld)", butt_weld: "لحام تناكبي (Butt Weld)", long: "نصف قطر طويل", short: "نصف قطر قصير", carbon_steel: "صلب كربوني", stainless_steel: "ستانلس ستيل", alloy_steel: "صلب سبائكي", duplex: "دوبلكس" };
const SHORT: Record<string, string> = { threaded: "THD", socket_weld: "SW", butt_weld: "BW", long: "LR", short: "SR", carbon_steel: "CS", stainless_steel: "SS", alloy_steel: "AS", duplex: "DX" };

export const optionNameAr = (key: string, en: string, given?: string | null) => given || OPTION_AR[key] || en;
export const valueLabelAr = (value: string, en: string, given?: string | null) => given || VALUE_AR[value] || en;

/** Short, stable code for SKUs: "forged-elbow-90" -> "FE90"; manufacturer "Bothwell" -> "BTW". */
export function familyCode(key: string) { return key.split("-").map((w) => (/^\d+$/.test(w) ? w : w[0])).join("").toUpperCase().slice(0, 8); }
export function brandCode(name: string) { const l = name.toUpperCase().replace(/[^A-Z]/g, ""); return (l[0] + l.slice(1).replace(/[AEIOU]/g, "")).slice(0, 3).padEnd(3, "X"); }
const valCode = (v: string) => SHORT[v] ?? v.toUpperCase().replace(/"/g, "").replace(/\s*x\s*/gi, "X").replace(/[^A-Z0-9X]+/g, "");

export function skuFor(p: ExtractedProduct, opts: Record<string, string>) {
  return [brandCode(p.manufacturer), familyCode(p.family.key), ...p.options.map((o) => valCode(opts[o.key] ?? ""))].filter(Boolean).join("-").slice(0, 80);
}

const label = (p: ExtractedProduct, key: string, value: string, ar = false) => {
  const o = p.options.find((x) => x.key === key); const v = o?.values.find((x) => x.value === value);
  return ar ? valueLabelAr(value, v?.label_en ?? value, v?.label_ar) : v?.label_en ?? value;
};
const list = (xs: string[]) => [...new Set(xs)];

/** Description text built only from fields that exist; states the source so buyers know where the data comes from. */
export function describe(p: ExtractedProduct) {
  const order = (k: string) => (p.options.find((o) => o.key === k)?.values ?? []).map((v) => v.value);
  const lbl = (k: string, ar = false) => { const used = new Set(p.variants.map((v) => v.options[k]).filter(Boolean)); const known = order(k); return [...known.filter((v) => used.has(v)), ...[...used].filter((v) => !known.includes(v))].map((v) => label(p, k, v, ar)); };
  const conns = lbl("connection"), classes = lbl("class"), sizes = lbl("size"), classesAr = lbl("class", true);
  const prefixed = (xs: string[], word: RegExp, pre: string) => (xs.every((x) => word.test(x)) ? xs : xs.map((x) => `${pre}${x}`));
  const prodStd = p.standards.filter((s) => s.scope === "product").map((s) => s.code);
  const mats = p.materials.map((m) => (m.grades.length ? `${m.type} (${m.grades.join(", ")})` : m.type));
  const pages = list(p.pages.map(String)).join(", ");
  const sizeRange = sizes.length ? (sizes.length > 2 ? `${sizes[0]} to ${sizes[sizes.length - 1]}` : sizes.join(" and ")) : "";
  const shortEn = [`${p.manufacturer} ${p.family.name_en}`, conns.length && `${conns.join(" / ")}`, classes.length && prefixed(classes, /class/i, "class ").join(", "), sizeRange && `sizes ${sizeRange}`, prodStd.length && `to ${prodStd.join(", ")}`].filter(Boolean).join(" · ");
  const en = [
    `${p.name_en} as listed in the ${p.manufacturer} catalogue.`,
    conns.length ? `Connections: ${conns.join(", ")}.` : "",
    classes.length ? `Pressure classes: ${classes.join(", ")}.` : "",
    sizes.length ? `Sizes: ${sizes.join(", ")}.` : "",
    prodStd.length ? `Standards: ${prodStd.join(", ")}.` : "",
    mats.length ? `Materials: ${mats.join("; ")}.` : "",
    p.dimension_tables.length ? "Dimensions for each size and class are shown in the Dimensions tab." : "",
    `Source: ${p.manufacturer} catalogue, page ${pages}. Please confirm the exact specification in your request for quotation.`,
  ].filter(Boolean).join(" ");
  const nameAr = p.name_ar ?? null;
  const connsAr = lbl("connection", true);
  const shortAr = nameAr ? [nameAr, connsAr.length && connsAr.join(" / "), classesAr.length && prefixed(classesAr, /فئة/, "فئة ").join("، "), sizeRange && `المقاسات ${sizes[0]}${sizes.length > 1 ? ` إلى ${sizes[sizes.length - 1]}` : ""}`, prodStd.length && `حسب ${prodStd.join("، ")}`].filter(Boolean).join(" · ") : null;
  const ar = nameAr ? [
    `${nameAr} كما ورد في كتالوج ${p.manufacturer}.`,
    connsAr.length ? `أنواع التوصيل: ${connsAr.join("، ")}.` : "",
    classesAr.length ? `فئات الضغط: ${classesAr.join("، ")}.` : "",
    sizes.length ? `المقاسات: ${sizes.join("، ")}.` : "",
    prodStd.length ? `المواصفات: ${prodStd.join("، ")}.` : "",
    p.dimension_tables.length ? "الأبعاد لكل مقاس وفئة موضحة في تبويب الأبعاد." : "",
    `المصدر: كتالوج ${p.manufacturer}، صفحة ${pages}. يرجى تأكيد المواصفة المطلوبة في طلب عرض السعر.`,
  ].filter(Boolean).join(" ") : null;
  return { short_desc_en: (p.short_en || shortEn).slice(0, 500), description_en: p.description_en || en, short_desc_ar: p.short_ar || shortAr, description_ar: p.description_ar || ar };
}

/** Build the variant rows for import (labels, standard columns, SKUs made unique against `taken`). */
export function buildVariants(p: ExtractedProduct, taken: Set<string>) {
  return p.variants.map((v) => {
    let sku = skuFor(p, v.options); let n = 2;
    while (taken.has(sku.toLowerCase())) sku = `${skuFor(p, v.options)}-${n++}`;
    taken.add(sku.toLowerCase());
    const lab = p.options.map((o) => label(p, o.key, v.options[o.key]));
    const labAr = p.options.map((o) => label(p, o.key, v.options[o.key], true));
    const get = (...keys: string[]) => { const k = keys.find((x) => v.options[x]); return k ? label(p, k, v.options[k]) : null; };
    return {
      sku, options: v.options, label_en: lab.join(" · "), label_ar: labAr.join(" · "),
      size: get("size"), pressure_class: get("class", "pressure_class"), schedule: get("schedule"), grade: get("grade"), material: get("material"),
      manufacturer_code: v.manufacturer_code ?? null, weight_kg: v.weight_kg ?? null, source_page: v.page ?? null,
    };
  });
}

export function buildOptions(p: ExtractedProduct) {
  return p.options.map((o) => ({ key: o.key, name_en: o.name_en, name_ar: optionNameAr(o.key, o.name_en, o.name_ar), values: o.values.map((v) => ({ value: v.value, label_en: v.label_en, label_ar: valueLabelAr(v.value, v.label_en, v.label_ar) })) }));
}

export function normalizeName(s: string, manufacturer?: string) {
  let x = s.toLowerCase();
  if (manufacturer) x = x.replace(manufacturer.toLowerCase(), " ");
  return x.replace(/°|º/g, " deg ").replace(/degrees?/g, " deg ").replace(/[^a-z0-9 ]+/g, " ").replace(/\b(fitting|fittings|forged|the|and|of)\b/g, " ").replace(/\s+/g, " ").trim();
}
