import { cn } from "@/lib/utils";
import type { PlaceholderKind } from "@/lib/images/placeholder";

/** Line drawings in a 100×100 box (stroke = currentColor). Deliberately schematic: they show a product type, not a product. */
const ART: Record<PlaceholderKind, React.ReactNode> = {
  pipe: <><ellipse cx="28" cy="50" rx="9" ry="18" /><ellipse cx="28" cy="50" rx="5" ry="11" /><path d="M28 32h46M28 68h46" /><path d="M74 32a9 18 0 0 1 0 36" /></>,
  elbow: <><path d="M22 34h22a30 30 0 0 1 30 30v14" /><path d="M22 58h22a6 6 0 0 1 6 6v14" /><ellipse cx="22" cy="46" rx="5" ry="12" /><ellipse cx="62" cy="78" rx="12" ry="5" /></>,
  tee: <><path d="M14 40h72M14 60h28M58 60h28M42 60v24M58 60v24" /><ellipse cx="14" cy="50" rx="4" ry="10" /><ellipse cx="86" cy="50" rx="4" ry="10" /><ellipse cx="50" cy="84" rx="8" ry="3" /></>,
  flange: <><circle cx="50" cy="50" r="34" /><circle cx="50" cy="50" r="14" /><circle cx="50" cy="50" r="20" strokeDasharray="2 3" />
    {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <circle key={i} cx={50 + 26 * Math.cos(a)} cy={50 + 26 * Math.sin(a)} r="3.2" />; })}</>,
  valve: <><path d="M14 52h14M72 52h14M14 40v24M86 40v24" /><path d="M28 40l22 12-22 12zM72 40L50 52l22 12z" /><path d="M50 52V28" /><ellipse cx="50" cy="24" rx="16" ry="4" /></>,
  gasket: <><circle cx="50" cy="50" r="34" /><circle cx="50" cy="50" r="27" /><circle cx="50" cy="50" r="22" strokeDasharray="1.5 2.5" /><circle cx="50" cy="50" r="16" /></>,
  fastener: <><path d="M16 46h68M16 54h68" /><path d="M22 46v8M28 46v8M72 46v8M78 46v8" strokeWidth="1" /><rect x="34" y="38" width="9" height="24" rx="1" /><rect x="57" y="38" width="9" height="24" rx="1" /></>,
  coupling: <><path d="M20 50a30 30 0 0 1 60 0" /><path d="M20 50a30 30 0 0 0 60 0" /><circle cx="50" cy="50" r="20" /><path d="M14 46h8v8h-8zM78 46h8v8h-8z" /></>,
  generic: <><path d="M50 18l28 14v34L50 82 22 66V32z" /><path d="M22 32l28 14 28-14M50 46v36" /></>,
};

/**
 * Shown when a product has no image yet: a light outline of the product type, clearly captioned "Photo coming soon"
 * (never an unrelated picture, never presented as a photograph).
 */
export function ProductPlaceholder({ kind, lang = "en", alt, className, compact }: { kind: PlaceholderKind; lang?: string; alt?: string; className?: string; compact?: boolean }) {
  const ar = lang === "ar";
  const caption = ar ? "الصورة قريباً" : "Photo coming soon";
  return (
    <div role="img" aria-label={alt ? `${alt} — ${ar ? "لا تتوفر صورة بعد" : "photo not yet available"}` : caption} data-placeholder={kind}
      className={cn("relative flex flex-col items-center justify-center gap-1 bg-steel-50 text-steel-400", className)}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className={compact ? "size-3/4" : "size-1/2"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ART[kind]}</svg>
      {!compact && <span className="rounded border border-steel-200 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-steel-600">{caption}</span>}
    </div>
  );
}
