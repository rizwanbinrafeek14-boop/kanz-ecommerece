"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, NativeSelect, Checkbox } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, Panel } from "./ui";
import { deleteAnnouncement, deleteMenuLink, reorderSections, saveAnnouncement, saveHomepageSection, saveMenuLink, saveSettings } from "@/lib/admin/content-actions";
import { run } from "@/lib/admin/client";
import { fromRiyadhInput, toRiyadhInput } from "@/lib/format";

export interface Sec { id: string; type: string; title_en: string | null; title_ar: string | null; subtitle_en: string | null; subtitle_ar: string | null; is_enabled: boolean; sort_order: number; limit: number }
export interface Ann { id: string; text_en: string; text_ar: string | null; link_url: string | null; starts_at: string | null; ends_at: string | null; is_active: boolean; sort_order: number }
export interface Lnk { id: string; menu: string; label_en: string; label_ar: string | null; url: string; sort_order: number; is_active: boolean }
const nn = (s: string | null | undefined) => (s == null || s.trim() === "" ? null : s.trim());
const SEC_NAME: Record<string, string> = { hero: "Hero banners", category_cards: "Category cards", featured_products: "Featured products", new_arrivals: "New arrivals", best_sellers: "Best sellers (needs real orders)", special_offers: "Special offers", brands: "Brand logos", announcement: "Announcement", why_us: "Why choose us", rfq_cta: "Request-a-quote banner", custom_html: "Custom" };
const MENUS: Record<string, string> = { header: "Header", footer_company: "Footer — Company", footer_products: "Footer — Products", footer_support: "Footer — Support", footer_legal: "Footer — Legal" };

function useSig<T>(rows: T[]) { const [list, setList] = React.useState(rows); const sig = JSON.stringify(rows); const last = React.useRef(sig); React.useEffect(() => { if (last.current !== sig) { last.current = sig; setList(rows); } }, [sig, rows]); return [list, setList] as const; }

export function ContentManager({ sections, announcements, links, settings, isAdmin }: { sections: Sec[]; announcements: Ann[]; links: Lnk[]; settings: Record<string, any>; isAdmin: boolean }) {
  return (
    <Tabs defaultValue="home">
      <TabsList className="h-auto flex-wrap"><TabsTrigger value="home">Homepage sections</TabsTrigger><TabsTrigger value="ann">Announcements</TabsTrigger><TabsTrigger value="menus">Menus & footer links</TabsTrigger><TabsTrigger value="company">Company, VAT & SEO</TabsTrigger></TabsList>
      <TabsContent value="home"><Sections rows={sections} /></TabsContent>
      <TabsContent value="ann"><Announcements rows={announcements} /></TabsContent>
      <TabsContent value="menus"><Links rows={links} /></TabsContent>
      <TabsContent value="company"><Settings s={settings} canEdit={isAdmin} /></TabsContent>
    </Tabs>
  );
}

function Sections({ rows }: { rows: Sec[] }) {
  const router = useRouter(); const [list, setList] = useSig(rows);
  const upd = (i: number, k: keyof Sec, v: string | boolean | number) => setList((l) => l.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const move = async (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= list.length) return; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; if (await run(reorderSections(next.map((r, n) => ({ id: r.id, sort_order: n * 10 })))) ) router.refresh(); };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Show, hide and reorder the homepage sections and change their headings. Leave a heading empty to use the default. Banners (hero, promo tiles) are managed under <strong>Banners</strong>; products are chosen with the Featured / New / Offer flags on each product.</p>
      {list.map((r, i) => (
        <div key={r.id} className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3"><span className="font-semibold">{SEC_NAME[r.type] ?? r.type}</span>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={r.is_enabled} onChange={(e) => upd(i, "is_enabled", e.target.checked)} />Visible</label>
            <div className="ms-auto flex"><Button size="icon" variant="ghost" className="size-8" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button><Button size="icon" variant="ghost" className="size-8" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Heading (English)" value={r.title_en ?? ""} onChange={(e) => upd(i, "title_en", e.target.value)} aria-label="Heading English" /><Input dir="rtl" placeholder="العنوان (العربية)" value={r.title_ar ?? ""} onChange={(e) => upd(i, "title_ar", e.target.value)} aria-label="Heading Arabic" />
            <Input placeholder="Sub-heading (English)" value={r.subtitle_en ?? ""} onChange={(e) => upd(i, "subtitle_en", e.target.value)} aria-label="Subheading English" /><Input dir="rtl" placeholder="العنوان الفرعي" value={r.subtitle_ar ?? ""} onChange={(e) => upd(i, "subtitle_ar", e.target.value)} aria-label="Subheading Arabic" />
          </div>
          {["featured_products", "new_arrivals", "special_offers"].includes(r.type) && <label className="mt-3 flex items-center gap-2 text-sm">Products to show <Input type="number" min={1} max={24} value={r.limit} onChange={(e) => upd(i, "limit", Number(e.target.value))} className="h-8 w-20" /></label>}
          <Button size="sm" className="mt-3" onClick={async () => { if (await run(saveHomepageSection(r.id, { title_en: nn(r.title_en), title_ar: nn(r.title_ar), subtitle_en: nn(r.subtitle_en), subtitle_ar: nn(r.subtitle_ar), is_enabled: r.is_enabled, sort_order: r.sort_order, limit: r.limit }), "Saved")) router.refresh(); }}><Save className="size-4" />Save section</Button>
        </div>))}
    </div>
  );
}

function Announcements({ rows }: { rows: Ann[] }) {
  const router = useRouter(); const [list, setList] = useSig(rows);
  const upd = (i: number, k: keyof Ann, v: string | boolean | number | null) => setList((l) => l.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">A thin bar above the header. If several are active, the first (lowest order) is shown. Schedules use Saudi time.</p>
      {list.map((r, i) => (
        <div key={r.id || `n${i}`} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <Input placeholder="Text (English) *" value={r.text_en} onChange={(e) => upd(i, "text_en", e.target.value)} aria-label="Text English" /><Input dir="rtl" placeholder="النص (العربية)" value={r.text_ar ?? ""} onChange={(e) => upd(i, "text_ar", e.target.value)} aria-label="Text Arabic" />
          <Input dir="ltr" placeholder="Link (optional) /rfq or https://…" value={r.link_url ?? ""} onChange={(e) => upd(i, "link_url", e.target.value)} aria-label="Link" /><Input type="number" min={0} value={r.sort_order} onChange={(e) => upd(i, "sort_order", Number(e.target.value))} aria-label="Order" />
          <Field label="Start (Saudi time)"><Input type="datetime-local" value={toRiyadhInput(r.starts_at)} onChange={(e) => upd(i, "starts_at", fromRiyadhInput(e.target.value))} /></Field><Field label="End (Saudi time)"><Input type="datetime-local" value={toRiyadhInput(r.ends_at)} onChange={(e) => upd(i, "ends_at", fromRiyadhInput(e.target.value))} /></Field>
          <div className="flex items-center gap-3 sm:col-span-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={r.is_active} onChange={(e) => upd(i, "is_active", e.target.checked)} />Active</label>
            <Button size="sm" className="ms-auto" onClick={async () => { if (await run(saveAnnouncement(r.id || null, { text_en: r.text_en, text_ar: nn(r.text_ar), link_url: nn(r.link_url), starts_at: r.starts_at, ends_at: r.ends_at, is_active: r.is_active, sort_order: r.sort_order }), "Saved")) router.refresh(); }}><Save className="size-4" />Save</Button>
            <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete" onClick={async () => { if (!r.id) { setList((l) => l.filter((_, n) => n !== i)); return; } if (confirm("Delete this announcement?") && (await run(deleteAnnouncement(r.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button></div>
        </div>))}
      <Button variant="outline" onClick={() => setList((l) => [...l, { id: "", text_en: "", text_ar: "", link_url: "", starts_at: null, ends_at: null, is_active: true, sort_order: l.length * 10 }])}><Plus className="size-4" />Add announcement</Button>
    </div>
  );
}

function Links({ rows }: { rows: Lnk[] }) {
  const router = useRouter(); const [list, setList] = useSig(rows);
  const upd = (i: number, k: keyof Lnk, v: string | boolean | number) => setList((l) => l.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Links in the website header menu and footer columns. Use paths like <code>/rfq</code> (the language is added automatically) or full <code>https://</code> addresses. Product categories appear in the mega menu automatically.</p>
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["Where", "Label (EN)", "Label (AR)", "URL", "Order", "On", ""].map((h) => <th key={h} className="p-2 text-start">{h}</th>)}</tr></thead>
        <tbody>{list.map((r, i) => (<tr key={r.id || `n${i}`} className="border-t">
          <td className="p-2"><NativeSelect value={r.menu} onChange={(e) => upd(i, "menu", e.target.value)} className="h-8 w-44" aria-label="Menu">{Object.entries(MENUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></td>
          <td className="p-2"><Input value={r.label_en} onChange={(e) => upd(i, "label_en", e.target.value)} className="h-8" aria-label="Label EN" /></td><td className="p-2"><Input dir="rtl" value={r.label_ar ?? ""} onChange={(e) => upd(i, "label_ar", e.target.value)} className="h-8" aria-label="Label AR" /></td>
          <td className="p-2"><Input dir="ltr" value={r.url} onChange={(e) => upd(i, "url", e.target.value)} className="h-8 font-mono text-xs" aria-label="URL" /></td><td className="p-2"><Input type="number" value={r.sort_order} onChange={(e) => upd(i, "sort_order", Number(e.target.value))} className="h-8 w-16" aria-label="Order" /></td>
          <td className="p-2"><Checkbox checked={r.is_active} onChange={(e) => upd(i, "is_active", e.target.checked)} aria-label="Active" /></td>
          <td className="whitespace-nowrap p-2"><Button size="icon" variant="ghost" className="size-8" aria-label="Save link" onClick={async () => { if (await run(saveMenuLink(r.id || null, { menu: r.menu as "header", label_en: r.label_en, label_ar: nn(r.label_ar), url: r.url, sort_order: r.sort_order, is_active: r.is_active }), "Saved")) router.refresh(); }}><Save className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label="Delete link" onClick={async () => { if (!r.id) { setList((l) => l.filter((_, n) => n !== i)); return; } if (confirm("Delete this link?") && (await run(deleteMenuLink(r.id), "Deleted"))) router.refresh(); }}><Trash2 className="size-4" /></Button></td></tr>))}</tbody></table></div>
      <Button variant="outline" onClick={() => setList((l) => [...l, { id: "", menu: "footer_company", label_en: "", label_ar: "", url: "/", sort_order: (l.length + 1) * 10, is_active: true }])}><Plus className="size-4" />Add link</Button>
    </div>
  );
}

function Settings({ s, canEdit }: { s: Record<string, any>; canEdit: boolean }) {
  const router = useRouter(); const g = (k: string) => String(s[`public.${k}`] ?? "");
  const [v, setV] = React.useState<Record<string, string>>(Object.fromEntries(["company_name_en", "company_name_ar", "company_tagline_en", "company_about_en", "company_phone", "company_whatsapp", "company_email_sales", "company_email_info", "company_address_en", "company_website", "vat_number", "company_cr_number", "seo_default_title", "seo_default_description"].map((k) => [k, g(k)])));
  const [vat, setVat] = React.useState(g("vat_rate") || "15");
  const [del, setDel] = React.useState({ delivery: s["public.delivery_options"]?.delivery ?? true, pickup: s["public.delivery_options"]?.pickup ?? true });
  const [pay, setPay] = React.useState({ bank_transfer: s["public.payment_methods"]?.bank_transfer ?? true, cod: s["public.payment_methods"]?.cod ?? false });
  const f = (k: string, label: string, hint?: string, area = false) => <Field label={label} hint={hint} className={area ? "sm:col-span-2" : ""}>{area ? <Textarea rows={3} disabled={!canEdit} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <Input disabled={!canEdit} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>;
  return (
    <div className="space-y-6">
      {!canEdit && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Only administrators can change company details, VAT and SEO settings.</p>}
      <Panel title="Saudi VAT"><div className="grid max-w-md gap-4">
        <Field label="VAT rate (%)" hint="Applied to new orders, quotations and invoices. Existing documents keep the rate they were issued with."><Input type="number" min={0} max={100} step="0.01" disabled={!canEdit} value={vat} onChange={(e) => setVat(e.target.value)} /></Field>
        {f("vat_number", "Company VAT registration number", "15 digits starting with 3. Printed on quotations and invoices. Leave blank until you have it.")}{f("company_cr_number", "Commercial registration (CR) number")}</div></Panel>
      <Panel title="Company details & contact"><div className="grid gap-4 sm:grid-cols-2">
        {f("company_name_en", "Company name (English)")}{f("company_name_ar", "Company name (Arabic)")}{f("company_phone", "Phone")}{f("company_whatsapp", "WhatsApp number", "Digits only with country code, e.g. 966507264938")}
        {f("company_email_sales", "Sales email")}{f("company_email_info", "Info email")}{f("company_website", "Website")}{f("company_tagline_en", "Tagline")}{f("company_address_en", "Address", undefined, true)}{f("company_about_en", "Short company description", undefined, true)}</div></Panel>
      <Panel title="Checkout options"><div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={del.delivery} onChange={(e) => setDel({ ...del, delivery: e.target.checked })} />Delivery</label><label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={del.pickup} onChange={(e) => setDel({ ...del, pickup: e.target.checked })} />Pickup</label>
        <label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={pay.bank_transfer} onChange={(e) => setPay({ ...pay, bank_transfer: e.target.checked })} />Bank transfer</label><label className="flex items-center gap-2"><Checkbox disabled={!canEdit} checked={pay.cod} onChange={(e) => setPay({ ...pay, cod: e.target.checked })} />Cash on delivery</label></div>
        <p className="mt-3 text-xs text-muted-foreground">Card / mada / Apple Pay / STC Pay appear once a payment gateway is connected (see the setup guide). They cannot be enabled before then.</p></Panel>
      <Panel title="Default SEO"><div className="grid gap-4">{f("seo_default_title", "Default page title")}{f("seo_default_description", "Default meta description", undefined, true)}</div></Panel>
      {canEdit && <Button size="lg" onClick={async () => { if (await run(saveSettings({ vat_rate: Number(vat), values: v as never, delivery: del, payments: pay }), "Settings saved")) router.refresh(); }}><Save className="size-4" />Save settings</Button>}
    </div>
  );
}
