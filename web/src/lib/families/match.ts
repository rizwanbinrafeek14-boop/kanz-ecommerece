/**
 * How sure are we that a manufacturer's product belongs on a family page next to the others?
 * Similar names are never enough: the option structure (connection / class / size …), the product standard and the
 * connection types must agree with the family's reference offering. Nothing is linked automatically; this only ranks the suggestions.
 */
export interface MatchInput {
  id: string; name: string; brand: string | null; optionKeys: string[]; optionValues: Record<string, string[]>; standards: string[];
}
export interface MatchResult { confidence: "exact" | "likely" | "uncertain"; reasons: string[] }

/** "ASME B16.11-2016", "ANSI B 16.11 - 1980" and "ASME B16.11" are the same standard for matching purposes. */
export function normStandard(code: string) {
  return code.toUpperCase().replace(/\bANSI\b/g, "ASME").replace(/\s+/g, "").replace(/[-–](19|20)\d\d$/, "").replace(/\(.*\)$/, "");
}
const qualifier = (name: string) => (name.match(/\(([^)]+)\)/)?.[1] ?? "").toLowerCase();

export function matchOffering(p: MatchInput, ref: MatchInput | null): MatchResult {
  if (!ref || ref.id === p.id) return { confidence: "exact", reasons: ["First manufacturer offering in this family (it defines the comparison for the others)."] };
  const reasons: string[] = []; let score = 0;
  // a choice with a single value (e.g. connection = threaded only) is not a real choice, so it does not count as a structural difference
  const real = (m: MatchInput) => m.optionKeys.filter((k) => (m.optionValues[k]?.length ?? 0) > 1).sort().join(", ");
  const a = real(p), b = real(ref);
  if (a === b && (a || p.optionKeys.length)) { score++; reasons.push(`Same choices as ${ref.brand ?? "the reference"}: ${a || "none"}.`); }
  else reasons.push(`Different choices: ${p.brand ?? "this product"} has [${a || "none"}], ${ref.brand ?? "the reference"} has [${b || "none"}].`);
  const sa = new Set(p.standards.map(normStandard)), sb = new Set(ref.standards.map(normStandard));
  const common = [...sa].filter((x) => sb.has(x));
  let conflict = false;
  if (common.length) reasons.push(`Common product standard: ${common.join(", ")}.`);
  else if (sa.size && sb.size) { conflict = true; reasons.push(`No common product standard (${[...sa].join(", ")} vs ${[...sb].join(", ")}).`); }
  else reasons.push("A product standard is not listed on one side, so it was not compared (not counted against the match).");
  if (p.optionValues.connection && ref.optionValues.connection) {
    const c = p.optionValues.connection.filter((x) => ref.optionValues.connection.includes(x));
    if (c.length) { score++; reasons.push(`Shared connection types: ${c.join(", ")}.`); } else reasons.push("No shared connection type.");
  }
  const qa = qualifier(p.name), qb = qualifier(ref.name);
  if (qa !== qb && (qa || qb)) { score -= 2; reasons.push(`Names carry different qualifiers: "${qa || "none"}" vs "${qb || "none"}" - check that these are really the same product.`); }
  const max = p.optionValues.connection && ref.optionValues.connection ? 2 : 1;   // same choices (+ shared connection types when both list them)
  if (conflict) score--;
  return { confidence: score >= max ? "exact" : score >= 1 ? "likely" : "uncertain", reasons };
}
