"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, MessageCircle, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Checkbox, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field, Panel } from "./ui";
import { SocialIcon, type SocialLinkRow } from "@/components/social-icon";
import { BRAND_ICONS } from "@/lib/brand-icons";
import { deleteSocialLink, reorderSocialLinks, saveContactWidget, saveSocialLink, setSocialActive } from "@/lib/admin/contact-actions";
import { run } from "@/lib/admin/client";
import { publicUrl } from "@/lib/format";

export interface WidgetRow { whatsapp_enabled: boolean; whatsapp_number: string; default_message_en: string; default_message_ar: string; icon_path: string | null; position: "left" | "right"; show_desktop: boolean; show_mobile: boolean; label_en: string; label_ar: string; description_en: string; description_ar: string; menu_label_en: string; menu_label_ar: string; show_call: boolean; call_number: string }
const PLATFORMS: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X (Twitter)", youtube: "YouTube", tiktok: "TikTok", snapchat: "Snapchat", custom: "Custom" };
const ACCEPT = "image/png,image/webp,image/svg+xml,.svg";
const MAX = 512 * 1024;
const WA = "#25D366";

function pickIcon(f: File | undefined, set: (f: File | null) => void) {
  if (!f) return;
  if (f.size > MAX) { toast.error("Icon is larger than 512 KB."); return; }
  if (!/^image\/(png|webp|svg\+xml)$/.test(f.type) && !/\.svg$/i.test(f.name)) { toast.error("Use a PNG, WebP or SVG icon."); return; }
  set(f);
}
/** Local preview URL for a chosen file (created once per file, released on change/unmount). */
function useObjectUrl(f: File | null) {
  const url = React.useMemo(() => (f ? URL.createObjectURL(f) : null), [f]);
  React.useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

/* ───────── WhatsApp / contact widget ───────── */
function WidgetForm({ initial }: { initial: WidgetRow }) {
  const router = useRouter(); const [w, setW] = React.useState(initial); const [file, setFile] = React.useState<File | null>(null); const [rm, setRm] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const preview = useObjectUrl(file);
  const t = <K extends keyof WidgetRow>(k: K, v: WidgetRow[K]) => setW((x) => ({ ...x, [k]: v }));
  const txt = (k: keyof WidgetRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => t(k, e.target.value as never);
  const save = async () => {
    setBusy(true);
    const fd = new FormData(); fd.set("data", JSON.stringify({ ...w, icon_path: undefined, removeIcon: rm })); if (file) fd.set("icon", file);
    const ok = await run(saveContactWidget(fd), "Contact settings saved"); setBusy(false);
    if (ok) { setFile(null); setRm(false); router.refresh(); }
  };
  const iconUrl = preview ?? (rm ? null : publicUrl("site-icons", w.icon_path));
  return (
    <Panel title="WhatsApp floating button & contact menu" actions={<Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save contact settings"}</Button>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={w.whatsapp_enabled} onChange={(e) => t("whatsapp_enabled", e.target.checked)} />Show the floating contact button on the website</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp number (international format)" hint="Example: +966 50 726 4938. Country code first, no leading 0."><Input inputMode="tel" dir="ltr" value={w.whatsapp_number} onChange={txt("whatsapp_number")} placeholder="+966…" /></Field>
            <Field label="Placement"><NativeSelect value={w.position} onChange={(e) => t("position", e.target.value as "left" | "right")}><option value="right">Bottom right</option><option value="left">Bottom left</option></NativeSelect></Field>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={w.show_desktop} onChange={(e) => t("show_desktop", e.target.checked)} />Show on desktop</label>
            <label className="flex items-center gap-2"><Checkbox checked={w.show_mobile} onChange={(e) => t("show_mobile", e.target.checked)} />Show on mobile</label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default message (English)" hint="Pre-filled in the customer’s WhatsApp chat."><Textarea value={w.default_message_en} onChange={txt("default_message_en")} maxLength={500} /></Field>
            <Field label="Default message (Arabic)"><Textarea dir="rtl" value={w.default_message_ar} onChange={txt("default_message_ar")} maxLength={500} /></Field>
            <Field label="Button label (English)" hint="Shown on the WhatsApp action."><Input value={w.label_en} onChange={txt("label_en")} maxLength={60} /></Field>
            <Field label="Button label (Arabic)"><Input dir="rtl" value={w.label_ar} onChange={txt("label_ar")} maxLength={60} /></Field>
            <Field label="Accessible description (English)" hint="Read aloud by screen readers."><Input value={w.description_en} onChange={txt("description_en")} maxLength={160} /></Field>
            <Field label="Accessible description (Arabic)"><Input dir="rtl" value={w.description_ar} onChange={txt("description_ar")} maxLength={160} /></Field>
            <Field label="Menu button label (English)" hint="Label of the button that opens the contact menu."><Input value={w.menu_label_en} onChange={txt("menu_label_en")} maxLength={40} /></Field>
            <Field label="Menu button label (Arabic)"><Input dir="rtl" value={w.menu_label_ar} onChange={txt("menu_label_ar")} maxLength={40} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={w.show_call} onChange={(e) => t("show_call", e.target.checked)} />Include a “Call” action in the menu</label>
            <Field label="Phone number for Call" hint="Leave empty to use the company phone from Content & settings."><Input inputMode="tel" dir="ltr" value={w.call_number} onChange={txt("call_number")} placeholder="+966…" /></Field>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">WhatsApp icon</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full text-white" style={{ background: WA }}>
                {iconUrl ? <img src={iconUrl} alt="" className="size-7 object-contain" /> : <SocialIcon platform="whatsapp" size={26} />}
              </span>
              <input type="file" accept={ACCEPT} aria-label="Upload a custom WhatsApp icon" className="text-sm" onChange={(e) => { pickIcon(e.target.files?.[0], (f) => { setFile(f); setRm(false); }); e.target.value = ""; }} />
              {(file || w.icon_path) && !rm && <Button type="button" variant="outline" size="sm" onClick={() => { setFile(null); setRm(true); }}>Use the official default icon</Button>}
            </div>
            <p className="text-xs text-muted-foreground">PNG, WebP or SVG, up to 512 KB, at least 16×16 px. Leave it alone to keep the official WhatsApp icon. SVG files are cleaned automatically.</p>
          </div>
        </div>
        <aside aria-label="Preview" className="rounded-xl border bg-muted/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
          <div className={`relative h-56 rounded-lg border bg-background`}>
            <div className={`absolute bottom-3 flex flex-col gap-2 ${w.position === "left" ? "left-3 items-start" : "right-3 items-end"}`}>
              <span className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-white shadow" style={{ background: WA }}>
                {iconUrl ? <img src={iconUrl} alt="" className="size-5 object-contain" /> : <SocialIcon platform="whatsapp" size={18} />}{w.label_en || "WhatsApp"}
              </span>
              {w.show_call && <span className="flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow"><Phone className="size-4" />Call</span>}
              <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground shadow"><MessageCircle className="size-4" />{w.menu_label_en || "Contact"}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{!w.whatsapp_enabled ? "The button is currently hidden." : `Visible on ${[w.show_desktop && "desktop", w.show_mobile && "mobile"].filter(Boolean).join(" and ") || "no devices"}.`} It sits clear of the cookie notice, navigation and product action bars automatically.</p>
        </aside>
      </div>
    </Panel>
  );
}

/* ───────── Social links ───────── */
type Draft = Omit<SocialLinkRow, "id" | "sort_order"> & { id: string | null; use_builtin: boolean };
const blank = (): Draft => ({ id: null, platform: "instagram", name: "Instagram", url: "", icon_path: null, accessible_label: "", is_active: true, show_header: false, show_footer: true, show_mobile_menu: true, show_floating: false, use_builtin: true });
const PLACES: [keyof Draft, string][] = [["show_header", "Header"], ["show_footer", "Footer"], ["show_mobile_menu", "Mobile menu"], ["show_floating", "Floating contact menu"]];

function LinkDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const router = useRouter(); const [d, setD] = React.useState(draft); const [file, setFile] = React.useState<File | null>(null); const [rm, setRm] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const preview = useObjectUrl(file);
  const hasBuiltin = d.platform in BRAND_ICONS;
  const iconUrl = preview ?? (rm || d.use_builtin ? null : publicUrl("site-icons", d.icon_path));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    const fd = new FormData(); fd.set("data", JSON.stringify({ id: d.id, platform: d.platform, name: d.name, url: d.url, accessible_label: d.accessible_label, is_active: d.is_active, show_header: d.show_header, show_footer: d.show_footer, show_mobile_menu: d.show_mobile_menu, show_floating: d.show_floating, use_builtin: d.use_builtin && !file, removeIcon: rm })); if (file) fd.set("icon", file);
    const ok = await run(saveSocialLink(fd), "Link saved"); setBusy(false);
    if (ok) { onClose(); router.refresh(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{d.id ? "Edit social link" : "Add social link"}</DialogTitle><DialogDescription>Only https:// profile addresses are accepted.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform"><NativeSelect value={d.platform} onChange={(e) => { const p = e.target.value; setD((x) => ({ ...x, platform: p, name: x.name === PLATFORMS[x.platform] || !x.name ? PLATFORMS[p] : x.name, use_builtin: p in BRAND_ICONS ? x.use_builtin : false })); }}>{Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
            <Field label="Platform name"><Input value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={60} /></Field>
          </div>
          <Field label="Profile URL"><Input type="url" dir="ltr" value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.instagram.com/yourpage" /></Field>
          <Field label="Accessible label" hint="Read by screen readers. Leave empty for “Name (opens in a new tab)”."><Input value={d.accessible_label} onChange={(e) => set("accessible_label", e.target.value)} maxLength={120} /></Field>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Icon</legend>
            {hasBuiltin && <label className="flex items-center gap-2 text-sm"><input type="radio" name="icon-src" checked={d.use_builtin && !file} onChange={() => { set("use_builtin", true); setFile(null); }} />Use the built-in {PLATFORMS[d.platform]} icon</label>}
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="icon-src" checked={!(d.use_builtin && !file)} onChange={() => set("use_builtin", false)} />{hasBuiltin ? "Upload my own icon" : "Upload an icon (otherwise a generic web icon is used)"}</label>
            {!(d.use_builtin && !file) && <input type="file" accept={ACCEPT} aria-label="Upload icon" className="text-sm" onChange={(e) => { pickIcon(e.target.files?.[0], (f) => { setFile(f); setRm(false); }); e.target.value = ""; }} />}
            <p className="text-xs text-muted-foreground">PNG, WebP or SVG, up to 512 KB. Icons are shown in a fixed square, so proportions are preserved.</p>
          </fieldset>
          <div><p className="mb-1.5 text-sm font-medium">Show in</p>
            <div className="grid grid-cols-2 gap-2 text-sm">{PLACES.map(([k, label]) => <label key={k} className="flex items-center gap-2"><Checkbox checked={d[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />{label}</label>)}</div></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={d.is_active} onChange={(e) => set("is_active", e.target.checked)} />Enabled</label>
          <div className="rounded-lg border bg-muted/40 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="flex items-center gap-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">{iconUrl ? <img src={iconUrl} alt="" className="size-5 object-contain" /> : <SocialIcon platform={d.platform} size={20} />}</span>
              <div className="min-w-0 text-sm"><p className="font-medium">{d.name || "Name"}</p><p className="truncate text-xs text-muted-foreground" dir="ltr">{d.url || "https://…"}</p></div>
            </div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save link"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Links({ links }: { links: SocialLinkRow[] }) {
  const router = useRouter(); const [edit, setEdit] = React.useState<Draft | null>(null);
  const sorted = [...links].sort((a, b) => a.sort_order - b.sort_order);
  const move = async (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= sorted.length) return; const arr = [...sorted]; [arr[i], arr[j]] = [arr[j], arr[i]]; if (await run(reorderSocialLinks(arr.map((x, n) => ({ id: x.id, sort_order: (n + 1) * 10 }))))) router.refresh(); };
  const toDraft = (l: SocialLinkRow): Draft => ({ id: l.id, platform: l.platform, name: l.name, url: l.url, icon_path: l.icon_path, accessible_label: l.accessible_label, is_active: l.is_active, show_header: l.show_header, show_footer: l.show_footer, show_mobile_menu: l.show_mobile_menu, show_floating: l.show_floating, use_builtin: !l.icon_path });
  return (
    <Panel title="Social media links" actions={<Button onClick={() => setEdit(blank())}><Plus className="size-4" />Add link</Button>}>
      {!sorted.length ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No social links yet. Add your real profile addresses; nothing is shown on the website until you do.</p> : (
        <ul className="divide-y">{sorted.map((l, i) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><SocialIcon platform={l.platform} iconPath={l.icon_path} size={20} /></span>
            <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-medium">{l.name}{!l.is_active && <Badge variant="secondary">Disabled</Badge>}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">{l.url}</p>
              <p className="text-xs text-muted-foreground">{PLACES.filter(([k]) => l[k as keyof SocialLinkRow]).map(([, n]) => n).join(" · ") || "Not shown anywhere"}</p></div>
            <div className="flex">
              <Button size="icon" variant="ghost" className="size-9" aria-label={`Move ${l.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
              <Button size="icon" variant="ghost" className="size-9" aria-label={`Move ${l.name} down`} disabled={i === sorted.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
              <Button size="icon" variant="ghost" className="size-9" aria-label={l.is_active ? `Disable ${l.name}` : `Enable ${l.name}`} onClick={async () => { if (await run(setSocialActive(l.id, !l.is_active))) router.refresh(); }}>{l.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
              <Button size="icon" variant="ghost" className="size-9" aria-label={`Edit ${l.name}`} onClick={() => setEdit(toDraft(l))}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" className="size-9 text-destructive" aria-label={`Delete ${l.name}`} onClick={async () => { if (confirm(`Delete ${l.name}?`) && (await run(deleteSocialLink(l.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          </li>))}</ul>)}
      {edit && <LinkDialog key={edit.id ?? "new"} draft={edit} onClose={() => setEdit(null)} />}
    </Panel>
  );
}

export function SocialManager({ widget, links }: { widget: WidgetRow; links: SocialLinkRow[] }) {
  return <div className="space-y-6"><WidgetForm initial={widget} /><Links links={links} /></div>;
}
