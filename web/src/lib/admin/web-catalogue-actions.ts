"use server";
/**
 * Manufacturer website catalogues: create a website source, crawl it step by step into the URL manifest (resumable,
 * robots.txt respected, one request every ≥ 2 s), extract product pages with Claude into the review area, retry failures.
 * Importing reviewed records goes through the same approve → import flow as PDF catalogues (catalogue-actions.ts).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit, fail, ok, uniqueSlug, type Result } from "./common";
import { claudeConfigured, extractWebPage } from "@/lib/catalogue/claude";
import { MIN_DELAY_MS, LIMITS, bareHost, extractionInput, fetchRobots, isSkippedUrl, normalizeUrl, parsePage, robotsAllows, safeFetch, sameSite, sourceKey, type RobotsRules } from "@/lib/catalogue/web";
import { storeProducts } from "./catalogue-store";

const done = (id: string) => { revalidatePath("/admin/catalogue"); revalidatePath(`/admin/catalogue/${id}`); };
const now = () => new Date().toISOString();
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "brand";

export interface WebSettings { path_prefix: string; max_pages: number; delay_ms: number; reuse_images: boolean; reuse_documents: boolean; permission_note: string | null }

const webSchema = z.object({
  title: z.string().trim().min(2).max(200), brand_id: z.string().uuid().nullable(), new_brand: z.string().trim().max(120).nullable(),
  start_url: z.string().trim().max(2000), path_prefix: z.string().trim().max(300).default(""),
  max_pages: z.number().int().min(1).max(5000).default(500), delay_ms: z.number().int().min(MIN_DELAY_MS).max(60000).default(3000),
  reuse_images: z.boolean().default(false), reuse_documents: z.boolean().default(false), permission_note: z.string().trim().max(1000).nullable().default(null),
});

/** New website source. Image / document copying is off unless the admin confirms permission (kept with the source for the record). */
export async function createWebSource(input: z.input<typeof webSchema>): Promise<Result<{ id: string }>> {
  const user = await requireStaff();
  const p = webSchema.safeParse(input); if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const d = p.data; const start = normalizeUrl(d.start_url);
  if (!start) return fail("Enter the full address of the manufacturer's product listing, starting with https://");
  if ((d.reuse_images || d.reuse_documents) && !d.permission_note) return fail("Note where the permission to reuse images / documents comes from (e.g. distributor agreement, written e-mail).");
  const u = new URL(start);
  const prefix = d.path_prefix ? (d.path_prefix.startsWith("/") ? d.path_prefix : `/${d.path_prefix}`) : u.pathname.replace(/[^/]*$/, "");   // default: the folder of the start page
  const sb = await createClient();
  let brandId = d.brand_id;
  if (!brandId && d.new_brand) {
    const { data: existing } = await sb.from("brands").select("id").ilike("name", d.new_brand).maybeSingle();
    if (existing) brandId = existing.id;
    else { const slug = await uniqueSlug(sb, "brands", slugify(d.new_brand)); const { data, error } = await sb.from("brands").insert({ name: d.new_brand, slug, is_active: false }).select("id").single(); if (error) return fail(error.message); brandId = data.id; }
  }
  if (!brandId) return fail("Choose the manufacturer or type a new one.");
  const settings: WebSettings = { path_prefix: prefix, max_pages: d.max_pages, delay_ms: d.delay_ms, reuse_images: d.reuse_images, reuse_documents: d.reuse_documents, permission_note: d.permission_note };
  const { data, error } = await sb.from("catalogue_sources").insert({ title: d.title, brand_id: brandId, kind: "website", start_url: start, allowed_host: bareHost(u.hostname), settings, status: "processing", crawl_state: "idle", created_by: user.id }).select("id").single();
  if (error) return fail(error.message);
  await sb.from("catalogue_web_pages").insert({ source_id: data.id, url: start, depth: 0, discovered_from: "start" });
  await audit(sb, user.id, "catalogue.web_create", "catalogue_sources", data.id, { start_url: start, settings });
  done(data.id); return ok({ id: data.id });
}

type Source = { id: string; brand_id: string | null; start_url: string; allowed_host: string; settings: WebSettings; robots: RobotsRules | null; crawl_state: string; brands: { name: string } | { name: string }[] | null };
async function loadSource(sb: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await sb.from("catalogue_sources").select("id, brand_id, start_url, allowed_host, settings, robots, crawl_state, brands(name)").eq("id", id).eq("kind", "website").maybeSingle();
  return data as Source | null;
}
const inScope = (url: string, s: Source) => { const u = new URL(url); return sameSite(u.hostname, s.allowed_host) && u.pathname.startsWith(s.settings.path_prefix || "/"); };

export interface CrawlProgress { state: string; queued: number; fetched: number; failed: number; blocked: number; skipped: number; documents: number; pages: number; message?: string }
async function progress(sb: Awaited<ReturnType<typeof createClient>>, id: string, state: string, message?: string): Promise<CrawlProgress> {
  const { data } = await sb.from("catalogue_web_pages").select("status, kind").eq("source_id", id);
  const rows = data ?? []; const c = (f: (r: { status: string; kind: string }) => boolean) => rows.filter(f).length;
  return { state, message, queued: c((r) => r.status === "queued"), fetched: c((r) => ["fetched", "extracted"].includes(r.status) && r.kind !== "document"), failed: c((r) => r.status === "failed"),
    blocked: c((r) => r.status === "blocked"), skipped: c((r) => r.status === "skipped" && r.kind !== "document"), documents: c((r) => r.kind === "document"), pages: c((r) => r.kind !== "document") };
}

/**
 * One crawl step (≈ 8 s of work): fetches queued pages in order of depth, waiting the polite delay between requests,
 * records each URL's result in the manifest and queues new in-scope links. Called repeatedly by the admin page; resumable.
 */
export async function crawlStep(sourceId: string): Promise<Result<CrawlProgress>> {
  const user = await requireStaff(); const sb = await createClient();
  const s = await loadSource(sb, sourceId); if (!s) return fail("Website source not found.");
  const origin = new URL(s.start_url).origin;
  if (!s.robots) {
    const robots = await fetchRobots(origin, s.allowed_host);
    await sb.from("catalogue_sources").update({ robots, updated_at: now() }).eq("id", sourceId); s.robots = robots;
    await audit(sb, user.id, "catalogue.web_robots", "catalogue_sources", sourceId, { status: robots.status, rules: robots.rules.length, disallow_all: !!robots.disallow_all });
    if (robots.disallow_all) {
      await sb.from("catalogue_sources").update({ crawl_state: "blocked" }).eq("id", sourceId);
      return ok(await progress(sb, sourceId, "blocked", robots.status ? `robots.txt answered ${robots.status}: nothing is crawled until it is readable.` : "robots.txt could not be read (site unreachable): nothing is crawled."));
    }
  }
  if (s.crawl_state === "blocked") return ok(await progress(sb, sourceId, "blocked", "The crawl is stopped. Check the manifest errors, then use Retry."));
  await sb.from("catalogue_sources").update({ crawl_state: "running", updated_at: now() }).eq("id", sourceId);
  const delay = Math.max(MIN_DELAY_MS, s.settings.delay_ms ?? 0, (s.robots.crawl_delay ?? 0) * 1000);
  const deadline = Date.now() + 8000;   // short steps: the admin page calls again until the crawl is done (fits any hosting time limit)
  let fetchedNow = 0;
  while (Date.now() < deadline) {
    const { data: next } = await sb.from("catalogue_web_pages").select("id, url, depth, attempts").eq("source_id", sourceId).eq("status", "queued").order("depth").order("created_at").limit(1);
    const pg = next?.[0]; if (!pg) break;
    const { count: crawled } = await sb.from("catalogue_web_pages").select("id", { count: "exact", head: true }).eq("source_id", sourceId).neq("kind", "document").in("status", ["fetched", "extracted", "failed"]);
    if ((crawled ?? 0) >= s.settings.max_pages) {
      await sb.from("catalogue_web_pages").update({ status: "skipped", skip_reason: `Page limit (${s.settings.max_pages}) reached — raise it and retry to continue.`, updated_at: now() }).eq("source_id", sourceId).eq("status", "queued");
      break;
    }
    if (!robotsAllows(s.robots, pg.url)) { await sb.from("catalogue_web_pages").update({ status: "blocked", error: "Disallowed by the site's robots.txt", updated_at: now() }).eq("id", pg.id); continue; }
    // polite delay since the last request to this site (also across steps)
    const { data: last } = await sb.from("catalogue_web_pages").select("fetched_at").eq("source_id", sourceId).not("fetched_at", "is", null).order("fetched_at", { ascending: false }).limit(1);
    const wait = last?.[0]?.fetched_at ? new Date(last[0].fetched_at).getTime() + delay - Date.now() : 0;
    if (wait > 0) { if (Date.now() + wait > deadline) break; await new Promise((r) => setTimeout(r, wait)); }
    try {
      const r = await safeFetch(pg.url, { accept: "html", sameHost: s.allowed_host, maxBytes: LIMITS.html, follow: false });
      fetchedNow++;
      if (r.status === 401 || r.status === 403 || r.status === 429) {
        // access refused or rate-limited: stop instead of retrying, never work around it
        await sb.from("catalogue_web_pages").update({ status: "failed", http_status: r.status, error: r.status === 429 ? "The site asked us to slow down (429). The crawl is paused." : "Access refused by the site. Not retried.", attempts: pg.attempts + 1, fetched_at: now(), updated_at: now() }).eq("id", pg.id);
        await sb.from("catalogue_sources").update({ crawl_state: "blocked" }).eq("id", sourceId);
        return ok(await progress(sb, sourceId, "blocked", `The site answered ${r.status} for ${pg.url}. The crawl stopped; nothing was bypassed.`));
      }
      if (r.location) {
        // redirect: recorded here, the target is queued (if it is on the site and in scope) and fetched in turn
        const target = r.location; const onSite = sameSite(new URL(target).hostname, s.allowed_host);
        if (onSite && inScope(target, s)) { const { error: qe } = await sb.from("catalogue_web_pages").upsert({ source_id: sourceId, url: target, depth: pg.depth, discovered_from: pg.url }, { onConflict: "source_id,url", ignoreDuplicates: true }); if (qe) throw new Error(qe.message); }
        await sb.from("catalogue_web_pages").update(onSite
          ? { status: "skipped", kind: "other", http_status: r.status, skip_reason: `Redirects to ${target}${inScope(target, s) ? "" : " (outside the import scope)"}`, attempts: pg.attempts + 1, fetched_at: now(), updated_at: now() }
          : { status: "failed", http_status: r.status, error: `Redirected away from the manufacturer's site (${new URL(target).hostname}).`, attempts: pg.attempts + 1, fetched_at: now(), updated_at: now() }).eq("id", pg.id);
        continue;
      }
      if (!r.body) { await sb.from("catalogue_web_pages").update({ status: "failed", http_status: r.status, error: `HTTP ${r.status}`, attempts: pg.attempts + 1, fetched_at: now(), updated_at: now() }).eq("id", pg.id); continue; }
      if (!/text\/html|application\/xhtml/.test(r.contentType)) { await sb.from("catalogue_web_pages").update({ status: "skipped", kind: "other", http_status: r.status, content_type: r.contentType.slice(0, 100), skip_reason: "Not an HTML page", fetched_at: now(), updated_at: now() }).eq("id", pg.id); continue; }
      const parsed = parsePage(r.body.toString("utf8"), r.url);
      // new links: pages in scope are queued, documents are listed (attached during import), everything else is ignored
      const fresh = parsed.links.map((l) => l.url).filter((u) => !isSkippedUrl(u) && inScope(u, s));
      const pagesFound = fresh.map((url) => ({ source_id: sourceId, url, depth: pg.depth + 1, discovered_from: pg.url }));
      const docsFound = parsed.documents.filter((d) => sameSite(new URL(d.url).hostname, s.allowed_host) || /^https:/.test(d.url))
        .map((d) => ({ source_id: sourceId, url: d.url, depth: pg.depth + 1, discovered_from: pg.url, kind: "document", status: "skipped", skip_reason: "Document — attached to its product during import" }));
      for (const rows of [pagesFound, docsFound]) if (rows.length) {   // separate inserts: the two row shapes differ
        const { error: ue } = await sb.from("catalogue_web_pages").upsert(rows, { onConflict: "source_id,url", ignoreDuplicates: true });
        if (ue) throw new Error(`Could not record the links of this page: ${ue.message}`);
      }
      await sb.from("catalogue_web_pages").update({ status: "fetched", http_status: r.status, content_type: r.contentType.slice(0, 100), title: parsed.title, text_content: extractionInput(r.url, parsed), content_hash: parsed.hash,
        attempts: pg.attempts + 1, error: null, fetched_at: now(), updated_at: now(), kind: fresh.length > 8 && parsed.text.length < 4000 ? "listing" : "unknown" }).eq("id", pg.id);
    } catch (e) {
      await sb.from("catalogue_web_pages").update({ status: "failed", error: (e as Error).message.slice(0, 500), attempts: pg.attempts + 1, fetched_at: now(), updated_at: now() }).eq("id", pg.id);
    }
  }
  const pr = await progress(sb, sourceId, "running");
  const finished = pr.queued === 0;
  if (finished) await sb.from("catalogue_sources").update({ crawl_state: "done", status: "reviewing", updated_at: now() }).eq("id", sourceId);
  if (fetchedNow) done(sourceId);
  return ok({ ...pr, state: finished ? "done" : "running" });
}

export async function setCrawlState(sourceId: string, state: "paused" | "idle"): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("catalogue_sources").update({ crawl_state: state, updated_at: now() }).eq("id", sourceId).eq("kind", "website");
  if (error) return fail(error.message); done(sourceId); return ok(null);
}

/** Retry: failed / limit-skipped pages are queued again (crawl), or fetched pages extracted again. robots.txt is re-read. */
export async function retryWebPages(sourceId: string, what: "crawl" | "extract", ids?: string[]): Promise<Result<{ reset: number }>> {
  const user = await requireStaff(); const sb = await createClient();
  const reset = what === "crawl" ? { status: "queued", error: null, skip_reason: null, updated_at: now() } : { status: "fetched", error: null, updated_at: now() };
  const base = () => { const q = sb.from("catalogue_web_pages").update(reset, { count: "exact" }).eq("source_id", sourceId); return ids?.length ? q.in("id", ids.slice(0, 1000)) : q; };
  const results = what === "crawl"
    ? await Promise.all([base().in("status", ["failed", "blocked"]), base().eq("status", "skipped").like("skip_reason", "Page limit%")])
    : [await base().eq("status", "failed").not("text_content", "is", null)];
  const bad = results.find((r) => r.error); if (bad?.error) return fail(bad.error.message);
  const count = results.reduce((n, r) => n + (r.count ?? 0), 0);
  if (what === "crawl") await sb.from("catalogue_sources").update({ robots: null, crawl_state: "idle", updated_at: now() }).eq("id", sourceId);
  await audit(sb, user.id, "catalogue.web_retry", "catalogue_sources", sourceId, { what, reset: count });
  done(sourceId); return ok({ reset: count ?? 0 });
}

export async function setWebPageSkipped(sourceId: string, pageId: string, reason: string | null): Promise<Result> {
  await requireStaff(); const sb = await createClient();
  const { error } = await sb.from("catalogue_web_pages").update(reason ? { status: "skipped", skip_reason: reason.slice(0, 500), updated_at: now() } : { status: "fetched", skip_reason: null, updated_at: now() }).eq("id", pageId).eq("source_id", sourceId);
  if (error) return fail(error.message); done(sourceId); return ok(null);
}

/** Extract one fetched page with Claude. Only product pages produce records; image / document links must appear on the page. */
export async function extractWebPageWithClaude(sourceId: string, pageId: string): Promise<Result<{ type: string; products: number; invalid: number; tokens: { input: number; output: number } }>> {
  await requireStaff();
  if (!claudeConfigured()) return fail("Claude extraction is not configured: add ANTHROPIC_API_KEY to the server environment (see the setup guide).");
  const sb = await createClient();
  const s = await loadSource(sb, sourceId); if (!s) return fail("Website source not found.");
  const { data: pg } = await sb.from("catalogue_web_pages").select("id, url, text_content, status").eq("id", pageId).eq("source_id", sourceId).maybeSingle();
  if (!pg?.text_content) return fail("Fetch the page first.");
  const manufacturer = (Array.isArray(s.brands) ? s.brands[0] : s.brands)?.name ?? "Unknown";
  const [{ data: fams }, { data: cats }] = await Promise.all([
    sb.from("extracted_products").select("data->family->>key").eq("source_id", sourceId),
    sb.from("categories").select("slug").eq("is_active", true),
  ]);
  // the image / document URLs recorded for the page when it was fetched (the only links an extraction may use)
  const listed = (label: string) => new Set<string>((pg.text_content!.split(label)[1]?.split("\n\n")[0] ?? "").split("\n").filter((l: string) => l.startsWith("- ")).map((l: string) => l.slice(2).split(" | ")[0].trim()));
  try {
    const r = await extractWebPage({ input: pg.text_content, url: pg.url, manufacturer, knownFamilies: [...new Set((fams ?? []).map((f) => Object.values(f)[0] as string).filter(Boolean))], categories: (cats ?? []).map((c) => c.slug),
      allowedImages: listed("IMAGES ON THE PAGE (url | alt text):"), allowedDocs: listed("DOCUMENT LINKS ON THE PAGE (url | link text):") });
    const products = r.pageType === "product" ? r.products.map((p) => ({ ...p, source_key: sourceKey(pg.url, p.manufacturer_ref || p.family.key) })) : [];
    if (products.length) await storeProducts(sb, sourceId, s.brand_id, products);
    await sb.from("catalogue_web_pages").update({ status: r.pageType === "product" || r.pageType === "listing" ? "extracted" : "skipped", kind: r.pageType === "other" ? "other" : r.pageType, products_found: products.length,
      skip_reason: r.pageType === "other" ? r.note ?? "No product data" : null, error: r.invalid.length ? `${r.invalid.length} product(s) did not pass validation: ${r.invalid.map((x) => x.error).join(" | ").slice(0, 900)}` : null, extracted_at: now(), updated_at: now() }).eq("id", pageId);
    done(sourceId); return ok({ type: r.pageType, products: products.length, invalid: r.invalid.length, tokens: r.usage });
  } catch (e) {
    await sb.from("catalogue_web_pages").update({ status: "failed", error: (e as Error).message.slice(0, 500), updated_at: now() }).eq("id", pageId);
    return fail((e as Error).message);
  }
}
