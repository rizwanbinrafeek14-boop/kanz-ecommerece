"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, FileJson, Loader2, Play, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, Checkbox } from "@/components/ui/input";
import { Panel, Stat } from "../ui";
import { createClient } from "@/lib/supabase/browser";
import { deleteSource, extractPageWithClaude, importApproved, loadExtractionFile, savePageRender, setExtractedStatus, setPageStatus } from "@/lib/admin/catalogue-actions";
import { run } from "@/lib/admin/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openPdf, renderPage } from "./pdf";

export interface PageRow { page_no: number; status: string; url: string | null; method: string | null; skip_reason: string | null; error: string | null; products_found: number }
export interface ItemRow { id: string; status: string; confidence: number | null; pages: number[]; name: string; family: string; variants: number; tables: number; images: number; duplicate: { kind?: string; message?: string } | null; imported: string | null; errors: number; warnings: number }
const PAGE_TONE: Record<string, string> = { pending: "bg-muted text-muted-foreground", rendered: "bg-sky-100 text-sky-900", extracted: "bg-emerald-100 text-emerald-900", needs_review: "bg-amber-100 text-amber-900", skipped: "bg-zinc-200 text-zinc-700", failed: "bg-red-100 text-red-900" };
// Claude Opus 5.5 list prices (USD per million tokens) used for the running cost estimate shown to the admin.
const PRICE = { input: 4, output: 20 };

export function SourceWorkbench({ sourceId, pdfUrl, pages, items, runs, claude, isAdmin }: { sourceId: string; pdfUrl: string | null; pages: PageRow[]; items: ItemRow[]; runs: { created_at: string; summary: { imported: number; failed: { name: string; error: string }[] } }[]; claude: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(""); const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [spent, setSpent] = React.useState({ input: 0, output: 0 });
  const [filter, setFilter] = React.useState("all"); const [sel, setSel] = React.useState<Set<string>>(new Set());
  const stop = React.useRef(false);
  const count = (s: string) => pages.filter((p) => p.status === s).length;

  const renderAll = async (only?: number) => {
    if (!pdfUrl) return toast.error("The PDF is missing.");
    const todo = pages.filter((p) => (only ? p.page_no === only : p.status === "pending" || p.status === "failed" && !p.url)).map((p) => p.page_no);
    if (!todo.length) return toast.info("All pages are already rendered.");
    setBusy("Rendering pages in your browser…"); stop.current = false; setProgress({ done: 0, total: todo.length });
    try {
      const doc = await openPdf(pdfUrl); const sb = createClient();
      for (const [i, n] of todo.entries()) {
        if (stop.current) break;
        const r = await renderPage(doc, n);
        const { error } = await sb.storage.from("import-staging").upload(`catalogue/${sourceId}/p${n}.png`, r.png, { contentType: "image/png", upsert: true });
        if (error) throw new Error(`Page ${n}: ${error.message}`);
        const res = await savePageRender(sourceId, n, r.text); if (!res.ok) throw new Error(res.error);
        setProgress({ done: i + 1, total: todo.length });
      }
      await doc.cleanup(); toast.success("Pages rendered");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); setProgress(null); router.refresh(); }
  };
  const extractAll = async (only?: number) => {
    const todo = pages.filter((p) => (only ? p.page_no === only : ["rendered", "failed"].includes(p.status) && p.url)).map((p) => p.page_no);
    if (!todo.length) return toast.info("No rendered pages are waiting for extraction.");
    setBusy("Extracting with Claude…"); stop.current = false; setProgress({ done: 0, total: todo.length });
    for (const [i, n] of todo.entries()) {
      if (stop.current) break;
      const r = await extractPageWithClaude(sourceId, n);
      if (r.ok) setSpent((s) => ({ input: s.input + r.data.tokens.input, output: s.output + r.data.tokens.output }));
      else toast.error(`Page ${n}: ${r.error}`);
      setProgress({ done: i + 1, total: todo.length }); router.refresh();
    }
    setBusy(""); setProgress(null); router.refresh();
  };
  const loadFile = async (f?: File) => { if (!f) return; setBusy("Loading extraction file…"); const r = await run(loadExtractionFile(sourceId, await f.text()), (d) => `${d.created} products added, ${d.merged} merged`); setBusy(""); if (r) router.refresh(); };
  const shown = items.filter((i) => filter === "all" || i.status === filter || (filter === "errors" && i.errors > 0) || (filter === "duplicates" && i.duplicate?.kind === "duplicate"));
  const bulk = async (status: "approved" | "rejected" | "pending") => { const r = await run(setExtractedStatus([...sel], status), (d) => `${d.changed} updated${d.blocked ? `, ${d.blocked} blocked (fix validation errors first)` : ""}`); if (r) { setSel(new Set()); router.refresh(); } };
  const doImport = async () => {
    const ids = items.filter((i) => i.status === "approved" && (!sel.size || sel.has(i.id))).map((i) => i.id);
    if (!ids.length) return toast.info("Approve records first.");
    if (!confirm(`Import ${ids.length} approved product(s) as unpublished drafts?`)) return;
    setBusy("Importing…"); const r = await run(importApproved(sourceId, ids), (d) => `${d.imported} imported${d.failed.length ? `, ${d.failed.length} failed` : ""}`); setBusy("");
    if (r && (r as { failed: { name: string; error: string }[] }).failed.length) toast.error((r as { failed: { name: string; error: string }[] }).failed.map((f) => `${f.name}: ${f.error}`).join("\n"), { duration: 15000 });
    router.refresh();
  };
  const cost = (spent.input * PRICE.input + spent.output * PRICE.output) / 1e6;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Pages" value={pages.length} /><Stat label="Rendered" value={pages.filter((p) => p.url).length} /><Stat label="Extracted" value={count("extracted")} />
        <Stat label="Needs review" value={count("needs_review") + count("failed")} tone={count("needs_review") + count("failed") ? "warn" : undefined} /><Stat label="Skipped" value={count("skipped")} /><Stat label="Products" value={items.length} hint={`${items.filter((i) => i.status === "imported").length} imported`} />
      </div>

      <Panel title="1 · Pages" actions={<div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => renderAll()}><Play className="size-4" />Render pages</Button>
        <Button size="sm" disabled={!!busy || !claude} onClick={() => extractAll()} title={claude ? "" : "Add ANTHROPIC_API_KEY to enable"}><Sparkles className="size-4" />Extract with Claude</Button>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"><FileJson className="size-4" />Load extraction file<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>}>
        {busy && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm" role="status" aria-live="polite"><Loader2 className="size-4 animate-spin" />{busy}{progress && <span className="tabular-nums">{progress.done}/{progress.total}</span>}<Button size="sm" variant="ghost" onClick={() => { stop.current = true; }}>Stop after this page</Button></div>}
        {!claude && <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Claude extraction is off: add an <code>ANTHROPIC_API_KEY</code> to the server environment to extract scanned pages automatically. You can still load a checked extraction file.</p>}
        {(spent.input > 0) && <p className="mb-3 text-sm text-muted-foreground">This session: {spent.input.toLocaleString()} input + {spent.output.toLocaleString()} output tokens ≈ ${cost.toFixed(2)} (Claude Opus 5.5 list price, estimate).</p>}
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {pages.map((p) => (
            <li key={p.page_no} className="group relative">
              <div className={cn("overflow-hidden rounded-md border", p.status === "needs_review" || p.status === "failed" ? "ring-2 ring-amber-400" : "")}>
                {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={`Page ${p.page_no}`} loading="lazy" className="aspect-[3/4] w-full bg-white object-contain" /></a> : <div className="flex aspect-[3/4] items-center justify-center bg-muted text-xs text-muted-foreground">not rendered</div>}
                <div className={cn("flex items-center justify-between px-1.5 py-1 text-[11px] font-medium", PAGE_TONE[p.status])}><span>p.{p.page_no}</span><span>{p.status.replace("_", " ")}{p.products_found ? ` · ${p.products_found}` : ""}</span></div>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {claude && p.url && <button type="button" className="text-[11px] text-primary underline" onClick={() => extractAll(p.page_no)}>extract</button>}
                <button type="button" className="text-[11px] underline" onClick={() => renderAll(p.page_no)}>render</button>
                {p.status !== "skipped" ? <button type="button" className="text-[11px] underline" onClick={async () => { const reason = prompt("Why is this page skipped? (e.g. company profile, photos only)"); if (reason && (await run(setPageStatus(sourceId, p.page_no, "skipped", reason)))) router.refresh(); }}>skip</button>
                  : <button type="button" className="text-[11px] underline" onClick={async () => { if (await run(setPageStatus(sourceId, p.page_no, "pending", null))) router.refresh(); }}>unskip</button>}
              </div>
              {(p.skip_reason || p.error) && <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground" title={p.skip_reason ?? p.error ?? ""}>{p.skip_reason ?? p.error}</p>}
            </li>))}
        </ul>
      </Panel>

      <Panel title="2 · Extracted products" actions={<div className="flex flex-wrap items-center gap-2">
        <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-40 text-xs" aria-label="Filter"><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="imported">Imported</option><option value="errors">With errors</option><option value="duplicates">Possible duplicates</option></NativeSelect>
        <Button size="sm" variant="outline" disabled={!sel.size} onClick={() => bulk("approved")}><CheckCircle2 className="size-4" />Approve</Button>
        <Button size="sm" variant="outline" disabled={!sel.size} onClick={() => bulk("rejected")}><XCircle className="size-4" />Reject</Button>
        <Button size="sm" disabled={!!busy || !items.some((i) => i.status === "approved")} onClick={doImport}>Import approved</Button>
      </div>}>
        {!items.length ? <p className="py-6 text-center text-sm text-muted-foreground">No products extracted yet. Render the pages, then extract with Claude or load an extraction file.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr className="border-b"><th className="p-2"><Checkbox aria-label="Select all" checked={shown.length > 0 && shown.every((i) => sel.has(i.id))} onChange={(e) => setSel(e.target.checked ? new Set(shown.filter((i) => i.status !== "imported").map((i) => i.id)) : new Set())} /></th><th className="p-2 text-start">Product</th><th className="p-2 text-end">Variants</th><th className="p-2 text-end">Tables</th><th className="p-2 text-end">Images</th><th className="p-2 text-start">Pages</th><th className="p-2 text-start">Checks</th><th className="p-2 text-start">Status</th></tr></thead>
            <tbody>{shown.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="p-2"><Checkbox aria-label={`Select ${i.name}`} disabled={i.status === "imported"} checked={sel.has(i.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} /></td>
                <td className="p-2"><Link href={`/admin/catalogue/${sourceId}/item/${i.id}`} className="font-medium hover:underline">{i.name}</Link><span className="block font-mono text-xs text-muted-foreground">{i.family}{i.confidence != null ? ` · confidence ${(i.confidence * 100).toFixed(0)}%` : ""}</span></td>
                <td className="p-2 text-end tabular-nums">{i.variants}</td><td className="p-2 text-end tabular-nums">{i.tables}</td><td className="p-2 text-end tabular-nums">{i.images}</td>
                <td className="p-2 text-xs">{i.pages.join(", ")}</td>
                <td className="p-2"><div className="flex flex-wrap gap-1">{i.errors > 0 && <Badge variant="destructive">{i.errors} {i.errors === 1 ? "error" : "errors"}</Badge>}{i.warnings > 0 && <Badge variant="warning">{i.warnings} {i.warnings === 1 ? "warning" : "warnings"}</Badge>}{i.duplicate?.kind === "duplicate" && <Badge variant="info" title={i.duplicate.message}>possible duplicate</Badge>}{i.duplicate?.kind === "family" && <Badge variant="secondary" title={i.duplicate.message}>shared family</Badge>}{!i.errors && !i.warnings && <Badge variant="success">ok</Badge>}</div></td>
                <td className="p-2"><Badge variant={i.status === "approved" ? "success" : i.status === "rejected" ? "destructive" : i.status === "imported" ? "info" : "secondary"}>{i.status}</Badge>{i.imported && <Link href={`/admin/products/${i.imported}`} className="ms-2 text-xs underline">product</Link>}</td>
              </tr>))}</tbody>
          </table></div>)}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Export">
          <div className="flex flex-wrap gap-2">{(["json", "csv", "xlsx"] as const).map((f) => <Button key={f} asChild size="sm" variant="outline"><a href={`/api/admin/catalogue/${sourceId}/export?format=${f}`}><Download className="size-4" />{f.toUpperCase()}</a></Button>)}</div>
          <p className="mt-2 text-xs text-muted-foreground">JSON contains everything (re-loadable); CSV/Excel list one row per variant with its source page.</p>
        </Panel>
        <Panel title="Import history">
          {!runs.length ? <p className="text-sm text-muted-foreground">No imports yet.</p> : <ul className="space-y-1 text-sm">{runs.map((r, i) => <li key={i}>{formatDateTime(r.created_at)}: {r.summary.imported} imported{r.summary.failed?.length ? `, ${r.summary.failed.length} failed` : ""}</li>)}</ul>}
          {isAdmin && <Button className="mt-4" size="sm" variant="ghost" onClick={async () => { if (confirm("Delete this catalogue, its pages and unimported records? Imported products are kept.") && (await run(deleteSource(sourceId), "Deleted"))) router.push("/admin/catalogue"); }}><Trash2 className="size-4" />Delete catalogue</Button>}
        </Panel>
      </div>
    </div>
  );
}
