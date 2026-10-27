/**
 * Placeholder drawings for products that have no image yet. The drawing only shows the product *type* (a flange
 * outline for flanges …) and is always labelled "Photo coming soon", so it can never pass for a photograph.
 * When the type is not clear from the product, the neutral "generic" drawing is used rather than a guess.
 */
export const PLACEHOLDER_KINDS = ["pipe", "elbow", "tee", "flange", "valve", "gasket", "fastener", "coupling", "generic"] as const;
export type PlaceholderKind = (typeof PLACEHOLDER_KINDS)[number];

export const PLACEHOLDER_LABELS: Record<PlaceholderKind, string> = {
  pipe: "Pipe", elbow: "Elbow / bend", tee: "Tee", flange: "Flange", valve: "Valve", gasket: "Gasket",
  fastener: "Stud bolt and nuts", coupling: "Grooved coupling", generic: "Neutral (no product type)",
};

// first matching rule wins: "flange gasket" is a gasket, "grooved coupling" a coupling; only elbows and tees have their own
// fitting drawing — caps, crosses, couplings, plugs, unions … get the neutral drawing rather than a different fitting's shape
const RULES: [PlaceholderKind, RegExp][] = [
  ["gasket", /gasket|ring[ -]?joint|\brtj\b|kammprofile|camprofile|jacketed|o-?ring|gland packing|seal(ing)?\b|جوان|حشو/i],
  ["valve", /valve|صمام|محبس/i],
  ["coupling", /grooved|victaulic|mechanical coupling|flexible coupling|rigid coupling|محزز/i],
  ["flange", /flange|فلنج|فلانج|شفة/i],
  ["fastener", /\bbolts?\b|\bstuds?\b|\bnuts?\b|براغي|صامولة/i],
  ["elbow", /elbow|\bbends?\b|كوع/i],
  ["tee", /\btees?\b/i],
  ["generic", /reducer|\bcaps?\b|coupling|union|nipple|\bplugs?\b|bushing|olet\b|swage|\bcross\b|insert|fitting|washer|screw|fastener|مخفض|وصلات|وصلة/i],
  // accessories that only mention a pipe: no drawing would be accurate, so they get the neutral one
  ["generic", /clamp|hanger|support|strainer|gauge|sleeve|insulation|\btapes?\b|\btools?\b/i],
  ["pipe", /\bpipes?\b|\btubes?\b|tubing|أنابيب|أنبوب|ماسورة/i],
];

/** The placeholder for a product: the admin's choice, else detected from its name, product type or category, else generic. */
export function placeholderKind(p: { placeholder_kind?: string | null; name_en?: string | null; product_type?: string | null; category_slug?: string | null }): PlaceholderKind {
  if (p.placeholder_kind && (PLACEHOLDER_KINDS as readonly string[]).includes(p.placeholder_kind)) return p.placeholder_kind as PlaceholderKind;
  for (const text of [p.name_en, p.product_type?.replace(/_/g, " "), p.category_slug?.replace(/-/g, " ")]) {
    if (!text) continue;
    const hit = RULES.find(([, re]) => re.test(text));
    if (hit) return hit[0];
  }
  return "generic";
}
