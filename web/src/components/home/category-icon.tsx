/** Line icons in the same drawing style as the hero, one per top-level category (generic fallback for others). */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<string, React.ReactNode> = {
  pipes: <><ellipse cx="12" cy="24" rx="5" ry="10" {...P} /><path d="M12 14h26M12 34h26" {...P} /><ellipse cx="38" cy="24" rx="5" ry="10" {...P} /><ellipse cx="12" cy="24" rx="2.4" ry="5.5" {...P} /></>,
  "pipe-fittings": <><path d="M6 30h14a10 10 0 0 0 10-10V6" {...P} /><path d="M6 42h14a22 22 0 0 0 22-22V6" {...P} /><path d="M6 30v12M30 6h12" {...P} /></>,
  "forged-fittings": <><rect x="14" y="14" width="20" height="20" {...P} /><path d="M4 20h10M4 28h10M34 20h10M34 28h10M20 4v10M28 4v10" {...P} /><path d="M4 18v12M44 18v12M18 4h12" {...P} /></>,
  "copper-grooved-fittings": <><path d="M4 18h40M4 30h40" {...P} /><rect x="16" y="12" width="16" height="24" rx="3" {...P} /><path d="M20 12v24M28 12v24" {...P} /><circle cx="24" cy="8" r="2" {...P} /><circle cx="24" cy="40" r="2" {...P} /></>,
  "plastic-fittings": <><path d="M4 18h16M4 30h16M28 18h16M28 30h16" {...P} /><path d="M20 14c2 0 2 20 0 20M28 14c-2 0-2 20 0 20" {...P} /><path d="M20 14h8M20 34h8" {...P} /></>,
  flanges: <><circle cx="24" cy="24" r="18" {...P} /><circle cx="24" cy="24" r="8" {...P} /><circle cx="24" cy="10" r="2" {...P} /><circle cx="24" cy="38" r="2" {...P} /><circle cx="10" cy="24" r="2" {...P} /><circle cx="38" cy="24" r="2" {...P} /></>,
  valves: <><path d="M4 28h10l10-8 10 8h10M4 20v16M44 20v16M14 28v-8M34 28v-8" {...P} /><path d="M14 20l20 16M34 20 14 36" {...P} /><path d="M24 24V10M16 10h16" {...P} /></>,
  fasteners: <><path d="M10 10h12v6H10zM14 16v26M18 16v26M14 22l4 2M14 28l4 2M14 34l4 2" {...P} /><path d="M30 26l6-3.5 6 3.5v7l-6 3.5-6-3.5z" {...P} /><circle cx="36" cy="29.5" r="2.5" {...P} /></>,
  "gaskets-gauges": <><circle cx="24" cy="22" r="15" {...P} /><path d="M24 22l7-7M14 28h20" {...P} /><path d="M20 37v7h8v-7" {...P} /></>,
  "other-products": <><path d="M10 18a14 14 0 0 1 28 0v12a14 14 0 0 1-28 0z" {...P} /><path d="M6 24h8M34 24h8M24 4v6M24 38v6" {...P} /></>,
};
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>{ICONS[slug] ?? ICONS["other-products"]}</svg>;
}
