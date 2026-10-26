/**
 * Automatic material classification.
 * Only two kinds of evidence are trusted enough to show a material in the shop without an admin ('auto'):
 *  1. an ASTM / ASME / UNS grade that maps to exactly one material (A234 WPB → CS, A403 WP316 → SS …), found in the
 *     product's own data (variant grade, grade attribute, or a catalogue grade list that is specific to this product);
 *  2. an explicit material written in the product's own name or material attribute ("Stainless Steel", "Brass" …).
 * Weaker evidence (a catalogue list printed "in general" / "non exhaustive", a keyword in a description) is stored as
 * 'unverified' and stays hidden until an admin approves it. A galvanized coating is recorded as GI with the base steel
 * in the note; zinc is never treated as the base material. Nothing here touches a row an admin has verified or edited.
 */
export type Status = "auto" | "unverified";
export interface Found { code: string; grades: string[]; status: Status; source: string; note?: string }
export interface VariantFound { variantId: string; code: string; source: string }
export interface DetectInput {
  name: string; shortDesc?: string | null; description?: string | null;
  attributes?: { key: string; value: string }[];
  variants?: { id: string; material?: string | null; grade?: string | null }[];
  specMaterials?: { type?: string; grades?: string[]; note?: string; page?: number }[];
}
export interface DetectResult { materials: Found[]; variants: VariantFound[]; conflicts: string[] }

const S = (t: string) => t.toUpperCase().replace(/[\s._-]+/g, "");
// a grade token, already normalised (no spaces): e.g. A234WPB, A182F316L, WP316L, S31803, F51
const GRADE_RULES: [RegExp, string][] = [
  // super duplex / duplex first (they would otherwise look like stainless)
  [/^(A182)?F(53|55)$|^(A815)?(WP)?S(32750|32760)$|^S(32750|32760)$|^(A182)?F61$/, "SDSS"],
  [/^(A182)?F(51|60)$|^(A815)?(WP)?S(31803|32205)$/, "DSS"],
  [/^(A182)?F(304|304L|304H|316|316L|316H|316TI|317|317L|321|321H|347|347H|310|310S|44)$|^(A403)?(WP|CR)?(304|304L|304H|316|316L|316H|317|317L|321|321H|347|347H|310S)(S|W|WX|WU)?$|^(A312)?TP(304|304L|316|316L|321|347)$|^(A403WP)?S31254$|^(WP)?S3(04|16|17|21|47)\d\d$/, "SS"],
  [/^(A182)?F(1|2|5|5A|9|11|11CL[123]|12|12CL[12]|22|22CL[13]|91|92|911)$|^(A234)?WP(1|5|9|11|12|22|91|911|92|R)(CL[123])?$|^(A335)?P(1|5|9|11|12|22|91|92)$|^(A350)?LF3$|^(A420)?WPL(3|8|9)$/, "AS"],
  [/^A105N?$|^(A234)?WP(B|C)(W)?$|^(A350)?LF(1|2)(CL[12])?$|^A106(GR)?[ABC]?$|^A53(GR)?[AB]?$|^A333(GR)?6$|^(A420)?WPL6$|^(A860)?WPHY\d\d$|^A694F\d\d$|^A181$/, "CS"],
  // nickel alloy fitting / forging specs and UNS numbers (ASTM B16 "brass rod" is left out: it clashes with ASME B16.x dimension standards)
  [/^B(366|564)$|^N0[4-9]\d{3}$/, "NI"],
  [/^C3[5-9]\d{3}$/, "BRASS"],
  [/^C9\d{4}$|^C83\d{3}$/, "BRONZE"],
];

/** Split a printed grade list entry into grade tokens, carrying the specification prefix forward ("A 403 WP304 / 304L" → A403WP304, A403WP304L). */
export function gradeTokens(list: string[]): { raw: string; token: string }[] {
  const out: { raw: string; token: string }[] = []; let spec = ""; let pre = "";
  for (const entry of list) {
    for (const part of entry.split(/\s*\/\s*/)) {
      let t = S(part.replace(/\bGR(ADE)?\.?\b/i, ""));
      if (!t) continue;
      const m = t.match(/^(A\d{2,3}|B\d{2,3})(.*)$/);
      if (m) { spec = m[1]; t = m[2] || ""; if (!t) { out.push({ raw: part.trim(), token: spec }); continue; } }
      // "304L" after "WP304" → "WP304L"
      if (/^\d/.test(t) && pre) t = pre + t;
      const pm = t.match(/^(WP|F|TP|LF|WPL|WPHY|P)(?=\d|S\d)/); pre = pm ? pm[1] : pre;
      out.push({ raw: spec ? `${spec} ${t}` : t, token: spec + t });
    }
  }
  return out;
}

export function gradeMaterial(token: string): string | null {
  const t = S(token);
  for (const [re, code] of GRADE_RULES) if (re.test(t)) return code;
  // without the spec prefix (e.g. "WPB" listed under a heading)
  const bare = t.replace(/^(A|B)\d{2,3}/, "");
  if (bare !== t) for (const [re, code] of GRADE_RULES) if (re.test(bare)) return code;
  return null;
}

// explicit material words (order matters: the more specific phrase first)
const WORDS: [RegExp, string][] = [
  [/super[\s-]*duplex/i, "SDSS"], [/\bduplex\b/i, "DSS"], [/stainless|\bSS\s?3[0-4]\d\b|\bS\.S\.?\b/i, "SS"],
  [/alloy[\s-]+steel|chrome[\s-]*moly|\bCr-?Mo\b/i, "AS"], [/carbon[\s-]+steel|\bC\.S\.?\b|\bMS\b|mild[\s-]+steel/i, "CS"],
  [/inconel|monel|hastelloy|incoloy|nickel[\s-]+alloy/i, "NI"],
  [/ductile[\s-]+iron|cast[\s-]+iron|malleable[\s-]+iron/i, "CI"],
  [/\bbrass\b/i, "BRASS"], [/\bbronze\b|gun[\s-]?metal/i, "BRONZE"], [/\bcopper\b(?![\s-]*(nickel|alloy))/i, "CU"],
  [/\balumin(i)?um\b/i, "AL"], [/\bHDPE\b|\bPE100\b|\bPE80\b/i, "HDPE"], [/\bCPVC\b/i, "CPVC"], [/\bu?PVC\b/i, "PVC"], [/\bPP-?R\b/i, "PPR"],
];
const GALV = /galvani[sz]ed|hot[\s-]*dip(ped)?\s+galv|\bG\.?I\.?\b/i;

function wordsIn(text: string): string[] {
  const out: string[] = [];
  let t = text;
  for (const [re, code] of WORDS) if (re.test(t)) { out.push(code); if (code === "SDSS") t = t.replace(/super[\s-]*duplex/ig, ""); }
  return out;
}
// a grade written inside free text: "A105", "ASTM A182 F316L", "WP304L", "F51"
function gradesInText(text: string): { raw: string; code: string }[] {
  const out: { raw: string; code: string }[] = [];
  const re = /\b(?:ASTM\s*)?((?:A|B)\s?\d{2,3}(?:\s*(?:GR\.?|GRADE)?\s*[A-Z]{0,4}\s?\d{0,3}[A-Z]{0,2}(?:\s?CL\s?\d)?)?|WP[A-Z]{0,3}\d{0,3}[A-Z]{0,2}|F\s?\d{1,3}[A-Z]{0,2}|S3\d{4}|TP3\d\d[A-Z]?)\b/g;
  const up = text.toUpperCase();
  for (const m of up.matchAll(re)) {
    // "ASME B16.11", "ANSI B16.5", "MSS SP-97", "API 5L" … are dimension / product standards, not material grades
    if (/(ASME|ANSI|MSS|API|BS|EN|DIN|ISO|JIS)[\s-]*$/.test(up.slice(Math.max(0, (m.index ?? 0) - 6), m.index))) continue;
    if (/^B\s?\d/.test(m[1]) && /^\./.test(up.slice((m.index ?? 0) + m[0].length))) continue;   // B16.11, B36.10 style numbers
    const code = gradeMaterial(m[1]); if (code) out.push({ raw: m[1].replace(/\s+/g, " ").trim(), code });
  }
  return out;
}

const GENERAL = /in general|non[\s-]*exhaustive|general|typical|e\.g\./i;

export function detectMaterials(p: DetectInput): DetectResult {
  const acc = new Map<string, Found>(); const variants: VariantFound[] = []; const conflicts: string[] = [];
  const add = (code: string, status: Status, source: string, grades: string[] = [], note?: string) => {
    const cur = acc.get(code);
    if (!cur) { acc.set(code, { code, grades: [...new Set(grades)], status, source, note }); return; }
    // stronger evidence replaces weaker; weaker evidence never adds grades to a row backed by stronger evidence
    if (status === "auto" && cur.status !== "auto") { cur.status = "auto"; cur.source = source; cur.grades = [...new Set(grades)]; }
    else {
      if (!cur.source.includes(source) && cur.source.length < 400) cur.source += `; ${status === cur.status ? "" : "also "}${source}`;
      if (status === cur.status) cur.grades = [...new Set([...cur.grades, ...grades])];
    }
    if (note && !cur.note) cur.note = note;
  };

  // 1. variants: their own material / grade columns
  for (const v of p.variants ?? []) {
    const fromGrade = v.grade ? gradeMaterial(v.grade) ?? gradesInText(v.grade)[0]?.code ?? null : null;
    const fromWord = v.material ? (GALV.test(v.material) ? "GI" : wordsIn(v.material)[0] ?? null) : null;
    const code = fromWord === "GI" ? "GI" : fromGrade ?? fromWord;
    if (fromGrade && fromWord && fromWord !== "GI" && fromGrade !== fromWord) conflicts.push(`Variant ${v.id}: material "${v.material}" but grade "${v.grade}" is ${fromGrade}.`);
    if (code) { variants.push({ variantId: v.id, code, source: fromGrade ? `variant grade ${v.grade}` : `variant material "${v.material}"` }); add(code, "auto", fromGrade ? `variant grade ${v.grade}` : `variant material "${v.material}"`, v.grade ? [v.grade] : []); }
  }

  // 2. attributes (material / grade) and the product name: explicit, product-specific
  const explicit: { text: string; where: string }[] = [{ text: p.name, where: "product name" }];
  for (const a of p.attributes ?? []) if (a.key === "material" || a.key === "grade") explicit.push({ text: a.value, where: `${a.key} attribute` });
  const namedCodes = new Set<string>();
  for (const e of explicit) {
    const galv = GALV.test(e.text);
    const grades = gradesInText(e.text);
    for (const g of grades) { add(galv && g.code === "CS" ? "GI" : g.code, "auto", `grade ${g.raw} in ${e.where}`, [g.raw], galv && g.code === "CS" ? "Galvanized coating on carbon steel" : undefined); namedCodes.add(g.code); }
    const words = wordsIn(e.text);
    if (galv) {
      const base = words.find((w) => w === "CS" || w === "CI") ?? (grades[0]?.code === "CS" ? "CS" : null);
      add("GI", "auto", `"galvanized" in ${e.where}`, [], base === "CI" ? "Galvanized coating on cast / malleable iron" : base === "CS" ? "Galvanized coating on carbon steel" : "Galvanized coating (base steel not stated)");
      namedCodes.add("GI");
      for (const w of words) if (w !== "CS" && w !== "CI") { add(w, "auto", `"${w}" in ${e.where}`); namedCodes.add(w); }
    } else for (const w of words) { add(w, "auto", `material written in ${e.where}`); namedCodes.add(w); }
  }

  // 3. catalogue grade lists stored with the product
  for (const m of p.specMaterials ?? []) {
    const general = GENERAL.test(m.note ?? "");
    const toks = gradeTokens(m.grades ?? []);
    const where = `catalogue ${general ? "general list" : "list"}${m.page ? ` p.${m.page}` : ""}`;
    const typeWords = wordsIn(m.type ?? "");
    const byCode = new Map<string, string[]>();
    for (const t of toks) { const code = gradeMaterial(t.token); if (code) byCode.set(code, [...(byCode.get(code) ?? []), t.raw]); }
    for (const [code, gs] of byCode) add(code, general ? "unverified" : "auto", `${where}: ${gs.slice(0, 4).join(", ")}${gs.length > 4 ? " …" : ""}`, gs);
    // a heading such as "Carbon steel" with no recognisable grade: keep it, but only for review
    if (!toks.some((t) => gradeMaterial(t.token))) for (const w of typeWords) add(w, "unverified", `heading "${m.type}" (${where})`);
  }

  // 4. descriptions: keywords only → unverified (never published without review)
  const desc = [p.shortDesc, p.description].filter(Boolean).join(" \n ");
  if (desc) {
    for (const g of gradesInText(desc)) add(g.code, "unverified", `grade ${g.raw} mentioned in the description`, [g.raw]);
    for (const w of wordsIn(desc)) add(w, "unverified", "keyword in the description");
    if (GALV.test(desc)) add("GI", "unverified", '"galvanized" in the description', [], "Galvanized coating");
  }

  // the product's own name/attributes name a material, but the catalogue grades point to another one
  if (namedCodes.size) for (const f of acc.values()) if (!namedCodes.has(f.code) && f.status === "auto" && /catalogue|variant grade/.test(f.source) && !(f.code === "CS" && namedCodes.has("GI")))
    conflicts.push(`The product name / attributes say ${[...namedCodes].join(", ")}, but the grades in its data give ${f.code}.`);
  return { materials: [...acc.values()], variants, conflicts };
}
