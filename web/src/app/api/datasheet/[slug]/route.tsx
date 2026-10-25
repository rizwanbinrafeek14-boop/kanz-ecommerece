import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { getProductBySlug } from "@/lib/queries/catalog";
import { getSettings, s } from "@/lib/settings";
import { publicUrl } from "@/lib/format";
import { abs } from "@/lib/seo";
import { DatasheetPdf } from "@/lib/pdf/datasheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF renderer accepts PNG/JPEG only: fetch our own public image and convert. */
async function png(url: string | null): Promise<string | null> {
  if (!url) return null;
  try { const r = await fetch(url); if (!r.ok) return null; const b = await sharp(Buffer.from(await r.arrayBuffer())).resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).png().toBuffer(); return `data:image/png;base64,${b.toString("base64")}`; } catch { return null; }
}
const fits = (want: Record<string, string>, have: Record<string, string>) => Object.entries(want).every(([k, v]) => have[k] === v);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return new NextResponse("Not found", { status: 404 });
  const d = await getProductBySlug(slug);   // published products only
  if (!d) return new NextResponse("Not found", { status: 404 });
  const vid = new URL(req.url).searchParams.get("variant");
  const v = vid ? d.variants.find((x) => x.id === vid) ?? null : null;
  const st = await getSettings(); const p = d.product;
  const lab = Object.fromEntries(d.options.map((o) => [o.key, Object.fromEntries(o.values.map((x) => [x.value, x.label_en]))]));
  const vLabel = (opts?: Record<string, string>) => d.options.map((o) => lab[o.key]?.[opts?.[o.key] ?? ""] ?? "").filter(Boolean).join(" · ");
  const tables = await Promise.all(d.dimensionTables.filter((t) => !v?.options || fits(t.applies, v.options)).map(async (t) => {
    const keys = [...new Set(t.rows.flatMap((r) => Object.keys(r.match)))];
    return { title: t.title_en, drawing: await png(publicUrl("product-images", t.drawing_path)), matchKeys: keys, page: t.source_page,
      columns: t.columns.map((c) => ({ key: c.symbol ?? c.key, label: c.label_en, unit: c.unit ?? null })),
      rows: t.rows.map((r) => ({ match: keys.map((k) => lab[k]?.[r.match[k]] ?? r.match[k] ?? "-"), values: t.columns.map((c) => r.values[c.key] ?? "-"), selected: !!v?.options && fits(r.match, v.options) })), notes: t.notes };
  }));
  const buf = await renderToBuffer(<DatasheetPdf d={{
    company: { name: s(st, "company_name_en", "KANZ CORNER EST."), phone: s(st, "company_phone"), email: s(st, "company_email_sales"), site: abs("/").replace(/\/$/, "") },
    product: { name: p.name_en, manufacturer: d.brand?.name ?? null, ref: p.manufacturer_ref ?? null, family: d.family?.name_en ?? null, url: abs(`/en/product/${p.slug}`), sourceTitle: p.source_ref?.title ?? null, pages: p.source_ref?.pages ?? [] },
    variant: v ? { sku: v.sku, label: vLabel(v.options) || v.label_en || v.sku, code: v.manufacturer_code ?? null, weight: v.weight_kg == null ? null : Number(v.weight_kg) } : null,
    specs: [...d.options.map((o) => [o.name_en, o.values.map((x) => x.label_en).join(", ")] as [string, string]), ...d.attributes.map((a) => [a.def.name_en, a.values.map((x) => x.value_en).join(", ")] as [string, string])],
    standards: p.specs?.standards ?? [], materials: p.specs?.materials ?? [], notes: p.specs?.notes ?? [],
    image: await png(publicUrl("product-images", d.images[0]?.storage_path)), tables,
  }} />);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${p.slug}${v ? `-${v.sku}` : ""}-datasheet.pdf"`, "cache-control": "public, max-age=300" } });
}
