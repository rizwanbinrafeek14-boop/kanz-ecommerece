import { Globe } from "lucide-react";
import { BRAND_ICONS } from "@/lib/brand-icons";
import { publicUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SocialLinkRow {
  id: string; platform: string; name: string; url: string; icon_path: string | null; accessible_label: string; sort_order: number; is_active: boolean;
  show_header: boolean; show_footer: boolean; show_mobile_menu: boolean; show_floating: boolean;
}

/** Uploaded icon if present, otherwise the built-in glyph for the platform. Always a fixed square box so every icon has the same size and proportions. */
export function SocialIcon({ platform, iconPath, size = 20, className, style }: { platform: string; iconPath?: string | null; size?: number; className?: string; style?: React.CSSProperties }) {
  const box = { width: size, height: size, ...style };
  const url = publicUrl("site-icons", iconPath);
  if (url) return <img src={url} alt="" aria-hidden="true" loading="lazy" decoding="async" style={box} className={cn("shrink-0 object-contain", className)} />;
  const b = BRAND_ICONS[platform];
  if (!b) return <Globe aria-hidden="true" style={box} className={cn("shrink-0", className)} />;
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={box} className={cn("shrink-0", className)}><path d={b.path} /></svg>;
}

export function SocialLinks({ links, size = 18, className, itemClassName }: { links: SocialLinkRow[]; size?: number; className?: string; itemClassName?: string }) {
  if (!links.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)}>
      {links.map((l) => (
        <li key={l.id}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.accessible_label} title={l.name}
            className={cn("inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 sm:size-10", itemClassName)}>
            <SocialIcon platform={l.platform} iconPath={l.icon_path} size={size} />
          </a>
        </li>
      ))}
    </ul>
  );
}
