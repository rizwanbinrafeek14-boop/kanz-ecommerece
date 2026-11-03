"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavCategory { id: string; href: string; name: string; image: string | null; children: { id: string; href: string; name: string }[] }

/**
 * Disclosure menu for the category bar: opens on click / tap and on hover (desktop), exposes aria-expanded,
 * and closes on Escape (focus returns to the button), on a click outside, or when a link inside is followed.
 */
function useDisclosure() {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLElement>(null); const button = React.useRef<HTMLButtonElement>(null);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);
  React.useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  const hover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;   // touch: click / tap only
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(next), next ? 80 : 200);
  };
  const rootProps = { ref: root as React.RefObject<never>, onPointerEnter: hover(true), onPointerLeave: hover(false),
    // leaving the menu with the keyboard closes it
    onBlur: (e: React.FocusEvent) => { if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false); } };
  // a click wins over a hover timer still pending from the pointer arriving (otherwise a quick click-to-close reopens 80 ms later)
  const toggle = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setOpen((o) => !o); };
  return { open, setOpen, toggle, button, rootProps };
}

export function CategoryMegaMenu({ label, viewAll, tree }: { label: string; viewAll: string; tree: NavCategory[] }) {
  const { open, setOpen, toggle, button, rootProps } = useDisclosure(); const id = React.useId();
  return (
    <div className="relative" {...rootProps}>
      <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={toggle} data-mega-menu
        className="flex h-12 items-center gap-2 bg-primary px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {label} <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="absolute start-0 top-full z-50 w-[min(1100px,92vw)] border bg-white shadow-2xl">
        <div className="grid max-h-[70vh] grid-cols-3 gap-x-6 gap-y-5 overflow-y-auto p-6 xl:grid-cols-4">
          {tree.map((c) => (
            <div key={c.id}>
              <Link href={c.href} onClick={() => setOpen(false)} className="mb-1.5 flex items-center gap-2 font-semibold text-ink hover:text-primary">
                {c.image && <img src={c.image} alt="" width={28} height={28} className="size-7 rounded object-contain" />}
                {c.name}
              </Link>
              {c.children.length > 0 && <ul className="space-y-0.5 border-s ps-3">
                {c.children.slice(0, 8).map((ch) => <li key={ch.id}><Link href={ch.href} onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-primary">{ch.name}</Link></li>)}
                {c.children.length > 8 && <li><Link href={c.href} onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">{viewAll} ({c.children.length})</Link></li>}
              </ul>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Top-level categories in the bar; the ones that do not fit (by screen width) are listed under "More". */
export function CategoryBar({ more, tree }: { more: string; tree: NavCategory[] }) {
  const { open, setOpen, toggle, button, rootProps } = useDisclosure(); const id = React.useId();
  // xl screens show 4 categories in the bar, lg screens 3; "More" lists the rest (the 4th only on lg)
  const rest = tree.slice(3);
  return (
    <ul className="flex flex-1 items-center gap-1 ps-3 text-sm font-medium" data-category-bar>
      {tree.slice(0, 4).map((c, i) => (
        <li key={c.id} className={i === 3 ? "hidden xl:block" : undefined}><Link href={c.href} className="block whitespace-nowrap px-3 py-3.5 hover:text-primary">{c.name}</Link></li>
      ))}
      {rest.length > 0 && (
        // with only 4 categories, xl screens show them all in the bar and need no "More"
        <li className={cn("relative", tree.length <= 4 && "xl:hidden")} {...rootProps}>
          <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={toggle} data-more-menu
            className="flex items-center gap-1 whitespace-nowrap px-3 py-3.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {more} <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
          </button>
          <ul id={id} hidden={!open} className="absolute end-0 top-full z-50 min-w-60 border bg-white py-2 shadow-xl">
            {rest.map((c, i) => (
              <li key={c.id} className={i === 0 ? "xl:hidden" : undefined}><Link href={c.href} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-muted hover:text-primary">{c.name}</Link></li>
            ))}
          </ul>
        </li>
      )}
    </ul>
  );
}
