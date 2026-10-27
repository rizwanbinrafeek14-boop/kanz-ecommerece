"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ExternalLink, FileJson, Loader2, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Panel, Stat } from "../ui";
import { crawlStep, extractWebPageWithClaude, retryWebPages, setCrawlState, setWebPageSkipped, type CrawlProgress, type WebSettings } from "@/lib/admin/web-catalogue-actions";
import { loadExtractionFile } from "@/lib/admin/catalogue-actions";
import { run } from "@/lib/admin/client";
import { formatDateTime } from "@/lib/format";

export interface WebPageRow { id: string; url: string; kind: string; status: string; http_status: number | null; title: string | null; products_found: number; skip_reason: string | null; error: string | null; attempts: number; fetched_at: string | null }
export interface WebInfo { startUrl: string; host: string; settings: WebSettings; crawlState: string; robots: { status: number; rules: number; crawl_delay: number | null; disallow_all?: boolean; fetched_at: string } | null }

const TONE: Record<string, "secondary" | "success" | "warning" | "destructive" | "info"> = { queued: "secondary", fetched: "info", extracted: "success", skipped: "secondary", failed: "destructive", blocked: "warning" };
const PRICE = { input: 4, output: 20 };   // Claude Opus 5.5 list prices, USD per million tokens (estimate shown to the admin)

export function WebCrawlPanel({ sourceId, info, rows, claude }: { sourceId: string; info: WebInfo; rows: WebPageRow[]; claude: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(""); const [live, setLive] = React.useState<CrawlProgress | null>(null); const [spent, setSpent] = React.useState({ input: 0, output: 0 });
  const [status, setStatus] = React.useState("all"); const [kind, setKind] = React.useState("all"); const [q, setQ] = React.useState(""); const [limit, setLimit] = React.useState(100);
  const stop = React.useRef(false);
  const c = (f: (r: WebPageRow) => boolean) => rows.filter(f).length;
  const pages = rows.filter((r) => r.kind !== "document");

  const crawl = async () => {
    setBusy("Crawling the manufacturer's site (one request every few seconds)…"); stop.current = false;
    try {
      for (;;) {
        const r = await crawlStep(sourceId);
        if (!r.ok) { toast.error(r.error, { duration: 10000 }); break; }
        setLive(r.data); router.refresh();
        if (r.data.state === "blocked") { toast.error(r.data.message ?? "The crawl stopped.", { duration: 15000 }); break; }
        if (r.data.state === "done") { toast.success(`Crawl finished: ${r.data.fetched} pages fetched, ${r.data.documents} documents found${r.data.failed ? `, ${r.data.failed} failed` : ""}.`); break; }
        if (stop.current) { await setCrawlState(sourceId, "paused"); toast.info("Crawl paused — resume any time."); break; }
      }
    } finally { setBusy(""); router.refresh(); }
  };
  const extract = async (only?: string) => {
    const todo = only ? [only] : rows.filter((r) => r.status === "fetched" && r.kind !== "document").map((r) => r.id);
    if (!todo.length) return toast.info("No fetched pages are waiting for extraction.");
    setBusy(`Extracting product pages with Claude…`); stop.current = false; let products = 0, failed = 0;
    for (const [i, id] of todo.entries()) {
      if (stop.current) break;
      setBusy(`Extracting product pages with Claude… ${i + 1}/${todo.length}`);
      const r = await extractWebPageWithClaude(sourceId, id);
      if (r.ok) { products += r.data.products; setSpent((s) => ({ input: s.input + r.data.tokens.input, output: s.output + r.data.tokens.output })); } else { failed++; toast.error(r.error); }
      if (i % 5 === 4) router.refresh();
    }
    setBusy(""); router.refresh(); toast.success(`${products} product record(s) extracted${failed ? `, ${failed} page(s) failed (retry later)` : ""}.`);
  };
  const loadFile = async (f?: File) => { if (!f) return; setBusy("Loading extraction file…"); const r = await run(loadExtractionFile(sourceId, await f.text()), (d) => `${d.created} products added, ${d.merged} replaced`); setBusy(""); if (r) router.refresh(); };

  const shown = rows.filter((r) => (status === "all" || r.status === status) && (kind === "all" || r.kind === kind) && (!q || r.url.toLowerCase().includes(q.toLowerCase()) || (r.title ?? "").toLowerCase().includes(q.toLowerCase())));
  const cost = (spent.input * PRICE.input + spent.output * PRICE.output) / 1e6;
  const s = info.settings;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8" data-crawl-stats>
        <Stat label="Pages found" value={pages.length} /><Stat label="Fetched" value={c((r) => r.kind !== "document" && ["fetched", "extracted"].includes(r.status))} />
        <Stat label="Waiting" value={c((r) => r.status === "queued")} /><Stat label="Product pages" value={c((r) => r.kind === "product")} />
        <Stat label="Listing pages" value={c((r) => r.kind === "listing")} /><Stat label="Documents" value={c((r) => r.kind === "document")} />
        <Stat label="Failed / blocked" value={c((r) => ["failed", "blocked"].includes(r.status))} tone={c((r) => ["failed", "blocked"].includes(r.status)) ? "warn" : undefined} />
        <Stat label="Products extracted" value={rows.reduce((n, r) => n + r.products_found, 0)} />
      </div>

      <Panel title="1 · Crawl the manufacturer's website" actions={<div className="flex flex-wrap gap-2">
        {busy ? <Button size="sm" variant="outline" onClick={() => { stop.current = true; }}><Pause className="size-4" />Pause</Button>
          : <Button size="sm" onClick={crawl} disabled={info.crawlState === "done" && !c((r) => r.status === "queued")} data-crawl><Play className="size-4" />{c((r) => r.fetched_at !== null) ? "Resume crawl" : "Start crawl"}</Button>}
        <Button size="sm" variant="outline" disabled={!!busy || !c((r) => ["failed", "blocked"].includes(r.status) || (r.status === "skipped" && !!r.skip_reason?.startsWith("Page limit")))} onClick={async () => { if (await run(retryWebPages(sourceId, "crawl"), (d) => `${d.reset} page(s) queued again`)) router.refresh(); }}><RotateCcw className="size-4" />Retry failed pages</Button>
      </div>}>
        {busy && <p className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm" role="status" aria-live="polite"><Loader2 className="size-4 animate-spin" />{busy}{live ? ` — ${live.fetched} fetched, ${live.queued} waiting` : ""}</p>}
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2" data-crawl-settings>
          <div><dt className="inline text-muted-foreground">Start page: </dt><dd className="inline break-all"><a href={info.startUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{info.startUrl}</a></dd></div>
          <div><dt className="inline text-muted-foreground">Scope: </dt><dd className="inline">{info.host}{s.path_prefix} · max {s.max_pages} pages · {Math.max(2, s.delay_ms / 1000, info.robots?.crawl_delay ?? 0)} s between requests</dd></div>
          <div><dt className="inline text-muted-foreground">robots.txt: </dt><dd className="inline" data-robots>{!info.robots ? "read when the crawl starts" : info.robots.disallow_all ? `not readable (${info.robots.status || "unreachable"}) — nothing is crawled` : `${info.robots.status === 200 ? `${info.robots.rules} rule(s)` : `none (${info.robots.status})`}${info.robots.crawl_delay ? `, Crawl-delay ${info.robots.crawl_delay} s` : ""} · read ${formatDateTime(info.robots.fetched_at)}`}</dd></div>
          <div><dt className="inline text-muted-foreground">Images / documents: </dt><dd className="inline" data-permission>{s.reuse_images ? "images copied" : "images not copied (links kept for review)"} · {s.reuse_documents ? "PDFs copied" : "documents linked to the manufacturer's file"}{s.permission_note ? ` — permission: ${s.permission_note}` : ""}</dd></div>
        </dl>
        {info.crawlState === "blocked" && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900" data-blocked>The crawl stopped because the site refused access, asked to slow down, or robots.txt could not be read. Nothing is bypassed. Check the failed rows below; Retry re-reads robots.txt and tries again.</p>}
      </Panel>

      <Panel title="2 · Extract product pages" actions={<div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!!busy || !claude || !c((r) => r.status === "fetched" && r.kind !== "document")} onClick={() => extract()} title={claude ? "" : "Add ANTHROPIC_API_KEY to enable"}><Sparkles className="size-4" />Extract fetched pages ({c((r) => r.status === "fetched" && r.kind !== "document")})</Button>
        <Button size="sm" variant="outline" disabled={!!busy || !c((r) => r.status === "failed" && r.fetched_at !== null && r.http_status === 200)} onClick={async () => { if (await run(retryWebPages(sourceId, "extract"), (d) => `${d.reset} page(s) ready to extract again`)) router.refresh(); }}><RotateCcw className="size-4" />Retry failed extractions</Button>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"><FileJson className="size-4" />Load extraction file<input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => loadFile(e.target.files?.[0])} /></label>
      </div>}>
        {!claude && <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Claude extraction is off: add an <code>ANTHROPIC_API_KEY</code> to the server environment. You can still load a checked extraction file (same format as the export).</p>}
        <p className="text-sm text-muted-foreground">Each fetched page is read once: listing and other pages are recorded as such, product pages become review records below. Only values stated on the page are taken; image and document links must appear on the page itself. A page extracted again replaces its pending record.</p>
        {spent.input > 0 && <p className="mt-2 text-sm text-muted-foreground">This session: {spent.input.toLocaleString()} input + {spent.output.toLocaleString()} output tokens ≈ ${cost.toFixed(2)} (estimate).</p>}
      </Panel>

      <Panel title={`URL manifest (${rows.length})`} actions={<div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><a href={`/api/admin/catalogue/${sourceId}/export?format=manifest`}><Download className="size-4" />CSV</a></Button>
        <Button asChild size="sm" variant="outline"><a href={`/api/admin/catalogue/${sourceId}/export?format=xlsx`}><Download className="size-4" />Excel (with products)</a></Button></div>}>
        <div className="mb-3 flex flex-wrap gap-2">
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40 text-sm" aria-label="Status filter"><option value="all">All statuses</option>{["queued", "fetched", "extracted", "skipped", "failed", "blocked"].map((x) => <option key={x} value={x}>{x} ({c((r) => r.status === x)})</option>)}</NativeSelect>
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-40 text-sm" aria-label="Type filter"><option value="all">All types</option>{["product", "listing", "document", "other", "unknown"].map((x) => <option key={x} value={x}>{x} ({c((r) => r.kind === x)})</option>)}</NativeSelect>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search URL or title" className="h-9 max-w-xs" aria-label="Search URL" />
        </div>
        <div className="overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="URL manifest">
          <table className="w-full min-w-[820px] text-sm" data-manifest>
            <thead className="bg-muted/60 text-xs"><tr><th className="p-2 text-start">URL</th><th className="p-2 text-start">Type</th><th className="p-2 text-start">Status</th><th className="p-2 text-end">HTTP</th><th className="p-2 text-end">Products</th><th className="p-2 text-start">Note</th><th className="p-2" /></tr></thead>
            <tbody>{shown.slice(0, limit).map((r) => (
              <tr key={r.id} className="border-t align-top" data-url={r.url} data-status={r.status} data-kind={r.kind}>
                <td className="max-w-[380px] p-2"><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 break-all text-primary hover:underline">{r.url}<ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" /></a>{r.title && <span className="block truncate text-xs text-muted-foreground">{r.title}</span>}</td>
                <td className="p-2 text-xs">{r.kind}</td>
                <td className="p-2"><Badge variant={TONE[r.status] ?? "secondary"}>{r.status}</Badge>{r.attempts > 1 && <span className="ms-1 text-xs text-muted-foreground">×{r.attempts}</span>}</td>
                <td className="p-2 text-end tabular-nums">{r.http_status ?? "—"}</td>
                <td className="p-2 text-end tabular-nums">{r.products_found || ""}</td>
                <td className="max-w-[260px] p-2 text-xs text-muted-foreground">{r.error ?? r.skip_reason ?? ""}</td>
                <td className="whitespace-nowrap p-2 text-xs">
                  {claude && ["fetched", "extracted", "failed"].includes(r.status) && r.kind !== "document" && r.fetched_at && <button type="button" disabled={!!busy} className="me-2 text-primary underline" onClick={() => extract(r.id)}>extract</button>}
                  {r.kind !== "document" && (r.status === "skipped" && !r.skip_reason?.startsWith("Page limit")
                    ? <button type="button" className="underline" onClick={async () => { if (await run(setWebPageSkipped(sourceId, r.id, null))) router.refresh(); }}>unskip</button>
                    : ["fetched", "extracted"].includes(r.status) && <button type="button" className="underline" onClick={async () => { const why = prompt("Why is this page skipped?"); if (why && (await run(setWebPageSkipped(sourceId, r.id, why)))) router.refresh(); }}>skip</button>)}
                </td>
              </tr>))}</tbody>
          </table>
        </div>
        {shown.length > limit && <Button className="mt-3" size="sm" variant="outline" onClick={() => setLimit((n) => n + 200)}>Show more ({shown.length - limit} more)</Button>}
        {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">Nothing discovered yet — start the crawl.</p>}
      </Panel>
    </div>
  );
}
