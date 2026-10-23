"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Checkbox } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./ui";
import { deleteBanner, reorderBanners, saveBanner, setBannerActive } from "@/lib/admin/banner-actions";
import { run, uploadToBucket } from "@/lib/admin/client";
import { formatDateTime, fromRiyadhInput, publicUrl, toRiyadhInput } from "@/lib/format";

export interface BannerRow { id: string; placement: string; title_en: string | null; title_ar: string | null; subtitle_en: string | null; subtitle_ar: string | null; cta_label_en: string | null; cta_label_ar: string | null; alt_en: string | null; alt_ar: string | null; desktop_image_path: string | null; mobile_image_path: string | null; link_url: string | null; category_id: string | null; starts_at: string | null; ends_at: string | null; is_active: boolean; sort_order: number; impressions: number; clicks: number }
export const PLACEMENTS: Record<string, { label: string; size: string }> = {
  home_hero: { label: "Homepage — hero carousel (full width)", size: "Desktop 1920×600 · Mobile 800×600" }, home_secondary: { label: "Homepage — promo tiles under categories (2 shown)", size: "Desktop 960×320" },
  home_strip: { label: "Homepage — thin strip under hero", size: "Desktop 1600×200" }, category_top: { label: "Category page — top banner", size: "Desktop 1600×300" },
  sidebar: { label: "Sidebar (reserved)", size: "400×500" }, popup: { label: "Popup (reserved)", size: "800×600" },
};
const blank = (): BannerRow => ({ id: "", placement: "home_hero", title_en: "", title_ar: "", subtitle_en: "", subtitle_ar: "", cta_label_en: "", cta_label_ar: "", alt_en: "", alt_ar: "", desktop_image_path: null, mobile_image_path: null, link_url: "", category_id: null, starts_at: null, ends_at: null, is_active: true, sort_order: 0, impressions: 0, clicks: 0 });
const nn = (s: string | null) => (s == null || s.trim() === "" ? null : s.trim());
function state(b: BannerRow) {
  const now = Date.now();
  if (!b.is_active) return { label: "Disabled", v: "secondary" as const };
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return { label: "Scheduled", v: "info" as const };
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return { label: "Expired", v: "destructive" as const };
  return { label: "Live", v: "success" as const };
}

export function BannerManager({ banners, categories }: { banners: BannerRow[]; categories: { id: string; name: string }[] }) {
  const router = useRouter(); const [edit, setEdit] = React.useState<BannerRow | null>(null); const [busy, setBusy] = React.useState(false);
  const [start, setStart] = React.useState(""); const [end, setEnd] = React.useState("");
  const openEdit = (b: BannerRow) => { setEdit({ ...b }); setStart(toRiyadhInput(b.starts_at)); setEnd(toRiyadhInput(b.ends_at)); };
  const set = (k: keyof BannerRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEdit((x) => x && ({ ...x, [k]: e.target.value }));
  const img = async (which: "desktop_image_path" | "mobile_image_path", f?: File) => { if (!f) return; try { const p = await uploadToBucket("banners", f, "ads"); setEdit((x) => x && ({ ...x, [which]: p })); } catch (e) { toast.error((e as Error).message); } };
  const move = async (list: BannerRow[], i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= list.length) return; if (await run(reorderBanners(list.map((x, n) => ({ id: x.id, sort_order: (n === i ? j : n === j ? i : n) * 10 }))), undefined) !== undefined) router.refresh(); };
  const groups = Object.keys(PLACEMENTS).map((p) => ({ p, list: banners.filter((b) => b.placement === p).sort((a, b) => a.sort_order - b.sort_order) })).filter((g) => g.list.length);

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => openEdit(blank())}><Plus className="size-4" />New banner</Button></div>
      {!groups.length && <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No banners yet. Until you add one, the homepage shows a default branded hero.</p>}
      {groups.map(({ p, list }) => (
        <section key={p} className="mb-8"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{PLACEMENTS[p].label}</h2>
          <ul className="space-y-3">{list.map((b, i) => { const st = state(b); const ctr = b.impressions ? (b.clicks / b.impressions) * 100 : 0; return (
            <li key={b.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
              <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted sm:w-64">{b.desktop_image_path || b.mobile_image_path ? <img src={publicUrl("banners", b.desktop_image_path ?? b.mobile_image_path)!} alt="" className="size-full object-cover" /> : null}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{b.title_en || "(no title)"}</p><Badge variant={st.v}>{st.label}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{b.starts_at ? `From ${formatDateTime(b.starts_at)}` : "No start date"} · {b.ends_at ? `until ${formatDateTime(b.ends_at)}` : "no end date"} (Riyadh)</p>
                <p className="text-xs text-muted-foreground">→ {b.link_url || "no link"}</p>
                <p className="mt-2 text-sm tabular-nums"><strong>{b.impressions.toLocaleString("en-US")}</strong> impressions · <strong>{b.clicks.toLocaleString("en-US")}</strong> clicks · CTR <strong>{ctr.toFixed(2)}%</strong></p></div>
              <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:items-end">
                <div className="flex"><Button size="icon" variant="ghost" className="size-8" aria-label="Move up" disabled={i === 0} onClick={() => move(list, i, -1)}><ArrowUp className="size-4" /></Button><Button size="icon" variant="ghost" className="size-8" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(list, i, 1)}><ArrowDown className="size-4" /></Button></div>
                <div className="flex"><Button size="icon" variant="ghost" className="size-8" aria-label={b.is_active ? "Disable" : "Enable"} onClick={async () => { if (await run(setBannerActive(b.id, !b.is_active), b.is_active ? "Disabled" : "Enabled")) router.refresh(); }}>{b.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Edit banner" onClick={() => openEdit(b)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete banner" onClick={async () => { if (confirm("Delete this banner?") && (await run(deleteBanner(b.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button></div>
              </div>
            </li>); })}</ul></section>))}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit banner" : "New banner"}</DialogTitle><DialogDescription>{edit && PLACEMENTS[edit.placement]?.size}</DialogDescription></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Placement" className="sm:col-span-2"><NativeSelect value={edit.placement} onChange={set("placement")}>{Object.entries(PLACEMENTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</NativeSelect></Field>
            {edit.placement === "category_top" && <Field label="Category" className="sm:col-span-2"><NativeSelect value={edit.category_id ?? ""} onChange={(e) => setEdit({ ...edit, category_id: e.target.value || null })}><option value="">— choose —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>}
            {(["desktop_image_path", "mobile_image_path"] as const).map((k) => (
              <div key={k}><p className="mb-1.5 text-sm font-medium">{k === "desktop_image_path" ? "Desktop image *" : "Mobile image (optional)"}</p>
                <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">{edit[k] ? <img src={publicUrl("banners", edit[k])!} alt="" className="size-full object-cover" /> : <span className="text-xs text-muted-foreground">No image</span>}</div>
                <label className="inline-block cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">Upload<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => img(k, e.target.files?.[0])} /></label>
                {edit[k] && <Button variant="ghost" size="sm" onClick={() => setEdit({ ...edit, [k]: null })}>Remove</Button>}</div>))}
            <Field label="Promotional title (English)"><Input value={edit.title_en ?? ""} onChange={set("title_en")} /></Field><Field label="Promotional title (Arabic)"><Input dir="rtl" value={edit.title_ar ?? ""} onChange={set("title_ar")} /></Field>
            <Field label="Subtitle (English)"><Input value={edit.subtitle_en ?? ""} onChange={set("subtitle_en")} /></Field><Field label="Subtitle (Arabic)"><Input dir="rtl" value={edit.subtitle_ar ?? ""} onChange={set("subtitle_ar")} /></Field>
            <Field label="Button text (English)"><Input value={edit.cta_label_en ?? ""} onChange={set("cta_label_en")} placeholder="Shop now" /></Field><Field label="Button text (Arabic)"><Input dir="rtl" value={edit.cta_label_ar ?? ""} onChange={set("cta_label_ar")} /></Field>
            <Field label="Destination URL" hint="/category/pipes (inside the site) or https://…" className="sm:col-span-2"><Input dir="ltr" value={edit.link_url ?? ""} onChange={set("link_url")} /></Field>
            <Field label="Image description for accessibility (English)"><Input value={edit.alt_en ?? ""} onChange={set("alt_en")} /></Field><Field label="Image description (Arabic)"><Input dir="rtl" value={edit.alt_ar ?? ""} onChange={set("alt_ar")} /></Field>
            <Field label="Start showing (Saudi time)"><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="Stop showing (Saudi time)"><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />Enabled</label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={busy} onClick={async () => { if (!edit) return; setBusy(true);
              const maxOrder = Math.max(-10, ...banners.filter((b) => b.placement === edit.placement).map((b) => b.sort_order)) + 10;
              const r = await run(saveBanner(edit.id || null, { placement: edit.placement as "home_hero", title_en: nn(edit.title_en), title_ar: nn(edit.title_ar), subtitle_en: nn(edit.subtitle_en), subtitle_ar: nn(edit.subtitle_ar), cta_label_en: nn(edit.cta_label_en), cta_label_ar: nn(edit.cta_label_ar), alt_en: nn(edit.alt_en), alt_ar: nn(edit.alt_ar), desktop_image_path: edit.desktop_image_path, mobile_image_path: edit.mobile_image_path, link_url: nn(edit.link_url), category_id: edit.placement === "category_top" ? edit.category_id : null, starts_at: fromRiyadhInput(start), ends_at: fromRiyadhInput(end), is_active: edit.is_active, sort_order: edit.id ? edit.sort_order : maxOrder }), "Banner saved");
              setBusy(false); if (r) { setEdit(null); router.refresh(); } }}>Save banner</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
