import { TITLE_SUFFIX, SEO_LIMITS } from "@/lib/seo-defaults";
import { cn } from "@/lib/utils";

/** Rough Google-style result preview. Google decides what it really shows (it may rewrite titles and snippets), so this is only an approximation. */
export function SeoPreview({ title, description, url, rtl, usingDefault }: { title: string; description: string; url: string; rtl?: boolean; usingDefault: { title: boolean; description: boolean } }) {
  const full = title.includes("KANZ CORNER") ? title : `${title}${TITLE_SUFFIX}`;
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const tl = full.length, dl = description.length;
  return (
    <figure className="rounded-lg border bg-white p-4" dir={rtl ? "rtl" : "ltr"}>
      <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Search result preview (approximation)</figcaption>
      <p className="truncate text-xs text-[#1a6b3a]" dir="ltr">{url}</p>
      <p className="mt-0.5 text-lg leading-snug text-[#1a0dab]">{cut(full, 62)}</p>
      <p className="mt-0.5 text-sm leading-snug text-[#4d5156]">{cut(description, 160) || "No description: Google will pick text from the page."}</p>
      <p className={cn("mt-2 text-xs", tl > SEO_LIMITS.title + TITLE_SUFFIX.length || dl > SEO_LIMITS.description ? "text-warning" : "text-muted-foreground")}>
        Title {tl} characters{usingDefault.title ? " (generated from the product data)" : ""} · Description {dl} characters{usingDefault.description ? " (generated)" : ""}. Titles over ~60 and descriptions over ~160 characters are usually shortened.
      </p>
    </figure>
  );
}
