"use client";
import * as React from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import { track } from "@/lib/track";
import { SocialIcon, type SocialLinkRow } from "@/components/social-icon";
import { cn } from "@/lib/utils";

export interface FloatProps {
  whatsappHref: string | null; whatsappLabel: string; whatsappDescription: string; iconUrl: string | null; callHref: string | null; callLabel: string;
  menuLabel: string; closeLabel: string; position: "left" | "right"; showDesktop: boolean; showMobile: boolean; links: SocialLinkRow[];
}

/** Expandable contact button: opens WhatsApp, Call and the social links marked “floating”. Lifts above the mobile enquiry bar via CSS (body:has([data-sticky-bar])). */
export function ContactFloat(p: FloatProps) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null); const toggle = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    const click = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key); document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [open]);
  if (!p.whatsappHref && !p.callHref && !p.links.length) return null;
  const vis = !p.showDesktop && !p.showMobile ? "hidden" : !p.showDesktop ? "md:hidden" : !p.showMobile ? "max-md:hidden" : "";
  const side = p.position === "left" ? "left-4 items-start" : "right-4 items-end";
  const item = "flex min-h-11 items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-black/5 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  return (
    <div ref={root} className={cn("contact-float no-print fixed bottom-4 z-40 flex flex-col gap-2", side, vis)}>
      {open && (
        <ul id="contact-menu" className={cn("flex flex-col gap-2 motion-safe:animate-[fade-up_.2s_ease-out]", p.position === "left" ? "items-start" : "items-end")}>
          {p.whatsappHref && (
            <li><a href={p.whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp_click")} aria-label={`${p.whatsappLabel}. ${p.whatsappDescription}`} className={cn(item, "bg-[#0f7a40] text-white")}>
              {p.iconUrl ? <img src={p.iconUrl} alt="" className="size-5 object-contain" /> : <SocialIcon platform="whatsapp" size={20} />}{p.whatsappLabel}</a></li>)}
          {p.callHref && <li><a href={p.callHref} onClick={() => track("phone_click")} className={cn(item, "bg-primary text-white")}><Phone className="size-5" aria-hidden="true" />{p.callLabel}</a></li>}
          {p.links.length > 0 && (
            <li><ul className="flex flex-wrap gap-2 rounded-full bg-white/95 p-1.5 shadow-lg ring-1 ring-black/5">
              {p.links.map((l) => <li key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.accessible_label} title={l.name} className="flex size-11 items-center justify-center rounded-full bg-ink text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><SocialIcon platform={l.platform} iconPath={l.icon_path} size={20} /></a></li>)}
            </ul></li>)}
        </ul>)}
      <button ref={toggle} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="contact-menu" aria-label={p.menuLabel}
        className="flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/10 transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {open ? <X className="size-5" aria-hidden="true" /> : <MessageCircle className="size-5" aria-hidden="true" />}<span>{open ? p.closeLabel : p.menuLabel}</span>
      </button>
    </div>
  );
}
