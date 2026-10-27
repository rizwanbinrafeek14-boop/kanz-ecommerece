import "server-only";
/**
 * Polite, safe fetching of a manufacturer's public website for the catalogue import.
 * - identifies itself, honours robots.txt (including Crawl-delay) and never goes faster than one request every 2 seconds;
 * - stays on the manufacturer's host (pages) and only fetches public internet addresses (no internal / private networks);
 * - follows redirects by hand (max 5) and re-checks every hop; caps response sizes and checks content types;
 * - never logs in, never sends cookies, never retries a refused request (401 / 403 / 429 stop the crawl for review).
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import sanitizeHtml from "sanitize-html";

export const CRAWLER_UA = "KanzCornerCatalogueImport/1.0 (+https://www.kanzcorner.com/en/contact; manufacturer catalogue import; low request rate)";
const UA_TOKEN = "kanzcornercatalogueimport";
export const MIN_DELAY_MS = 2000;
export const LIMITS = { html: 5 * 1024 * 1024, image: 15 * 1024 * 1024, document: 25 * 1024 * 1024 };
const DOC_EXT = /\.(pdf|docx?|xlsx?|dwg|dxf|stp|step)$/i;
const SKIP_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|ico|css|js|json|xml|zip|rar|7z|mp4|mov|avi|mp3|woff2?|ttf|eot)$/i;

// ───────── URLs ─────────
/** Absolute http(s) URL without fragment and tracking parameters; null for anything else (mailto:, javascript:, …). */
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    u.hash = ""; u.hostname = u.hostname.toLowerCase();
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_)/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return null; }
}
/** The host without "www.", so www.example.com and example.com are the same site. */
export const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");
export const sameSite = (host: string, allowed: string) => bareHost(host) === bareHost(allowed);
/** Stable identity of a product found on a page: page URL (scheme-less, no trailing slash) + model. */
export function sourceKey(pageUrl: string, model: string) {
  const u = new URL(pageUrl);
  const page = `${bareHost(u.hostname)}${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`;
  return `${page}#${model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)}`;
}
export const isDocumentUrl = (u: string) => DOC_EXT.test(new URL(u).pathname);
export const isSkippedUrl = (u: string) => SKIP_EXT.test(new URL(u).pathname);

// ───────── Network safety ─────────
function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return privateIp(x.slice(7));
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}
/** Refuses hosts that resolve to private, loopback or link-local addresses (protects the server's own network). */
async function assertPublicHost(host: string) {
  if (process.env.CATALOGUE_CRAWL_ALLOW_PRIVATE === "1") return;   // automated tests against a local test site only
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`The host ${host} could not be resolved.`);
  if (addrs.some((a) => privateIp(a.address))) throw new Error(`The host ${host} points to a private network address and is not fetched.`);
}

export interface Fetched { url: string; status: number; contentType: string; body: Buffer | null; location?: string }
/**
 * GET with manual redirects (each hop checked), a timeout, a content-type check and a size cap.
 * `follow: false` returns a redirect instead of following it (the crawler queues the target and fetches it at the polite rate).
 */
export async function safeFetch(url: string, opts: { accept: "html" | "image" | "document" | "text"; sameHost?: string; maxBytes: number; follow?: boolean }): Promise<Fetched> {
  let cur = url;
  for (let hop = 0; hop <= 5; hop++) {
    const u = new URL(cur);
    if (opts.sameHost && !sameSite(u.hostname, opts.sameHost)) throw new Error(`Redirected away from the manufacturer's site (${u.hostname}).`);
    await assertPublicHost(u.hostname);
    const res = await fetch(cur, {
      redirect: "manual", signal: AbortSignal.timeout(25000),
      headers: { "user-agent": CRAWLER_UA, accept: { html: "text/html,application/xhtml+xml", image: "image/*", document: "application/pdf,*/*;q=0.5", text: "text/plain,*/*;q=0.5" }[opts.accept] },
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location"); await res.body?.cancel();
      const next = loc ? normalizeUrl(loc, cur) : null; if (!next) throw new Error("Invalid redirect.");
      if (opts.follow === false) return { url: cur, status: res.status, contentType: "", body: null, location: next };
      cur = next; continue;
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!res.ok) { await res.body?.cancel(); return { url: cur, status: res.status, contentType, body: null }; }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > opts.maxBytes) { await res.body?.cancel(); throw new Error(`The file is larger than ${Math.round(opts.maxBytes / 1048576)} MB.`); }
    const reader = res.body?.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    if (reader) for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > opts.maxBytes) { await reader.cancel(); throw new Error(`The file is larger than ${Math.round(opts.maxBytes / 1048576)} MB.`); }
      chunks.push(value);
    }
    return { url: cur, status: res.status, contentType, body: Buffer.concat(chunks) };
  }
  throw new Error("Too many redirects.");
}

// ───────── robots.txt ─────────
export interface RobotsRules { status: number; fetched_at: string; rules: { allow: boolean; path: string }[]; crawl_delay: number | null; disallow_all?: boolean }

/** Rules for our crawler: the group naming it, else the "*" group (robots.txt standard, RFC 9309). */
export function parseRobots(txt: string, status = 200): RobotsRules {
  type G = { agents: string[]; rules: { allow: boolean; path: string }[]; delay: number | null };
  const groups: G[] = []; let cur: G | null = null; let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim(); if (!line) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase(), val = line.slice(i + 1).trim();
    if (key === "user-agent") { if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); } cur.agents.push(val.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false; if (!cur) continue;
    if (key === "disallow" && val) cur.rules.push({ allow: false, path: val });
    else if (key === "allow" && val) cur.rules.push({ allow: true, path: val });
    else if (key === "crawl-delay" && Number(val) > 0) cur.delay = Math.min(60, Number(val));
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && UA_TOKEN.includes(a.replace(/[^a-z0-9]/g, ""))));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return { status, fetched_at: new Date().toISOString(), rules: use.flatMap((g) => g.rules), crawl_delay: use.map((g) => g.delay).find((d) => d != null) ?? null };
}
function ruleMatches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const re = new RegExp("^" + pattern.replace(/\$$/, "").split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}
/** Longest matching rule wins; on a tie Allow wins; no matching rule = allowed. */
export function robotsAllows(r: RobotsRules | null, url: string): boolean {
  if (!r) return false;
  if (r.disallow_all) return false;
  const u = new URL(url); const path = u.pathname + u.search;
  let best: { allow: boolean; len: number } | null = null;
  for (const rule of r.rules) if (ruleMatches(rule.path, path) && (!best || rule.path.length > best.len || (rule.path.length === best.len && rule.allow))) best = { allow: rule.allow, len: rule.path.length };
  return best ? best.allow : true;
}
/** robots.txt of the site: 4xx = no rules (allowed); 5xx or unreachable = treat everything as disallowed (crawl stops for review). */
export async function fetchRobots(origin: string, host: string): Promise<RobotsRules> {
  try {
    const r = await safeFetch(`${origin}/robots.txt`, { accept: "text", sameHost: host, maxBytes: 512 * 1024 });
    if (r.status >= 400 && r.status < 500) return { status: r.status, fetched_at: new Date().toISOString(), rules: [], crawl_delay: null };
    if (!r.body) return { status: r.status, fetched_at: new Date().toISOString(), rules: [], crawl_delay: null, disallow_all: true };
    return parseRobots(r.body.toString("utf8"), r.status);
  } catch { return { status: 0, fetched_at: new Date().toISOString(), rules: [], crawl_delay: null, disallow_all: true }; }
}

// ───────── Page content ─────────
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", plusmn: "±", times: "×", micro: "µ", sup2: "²", frac12: "½", frac14: "¼", frac34: "¾", ndash: "–", mdash: "—" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, e: string) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const attr = (tag: string, name: string) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag); return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null; };
const stripTags = (h: string) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export interface ParsedPage { title: string; text: string; links: { url: string; text: string }[]; images: { url: string; alt: string }[]; documents: { url: string; text: string }[]; hash: string }

/** Cleans a page (scripts, styles, forms removed) into text with tables kept as rows, plus its links, images and documents. */
export function parsePage(html: string, pageUrl: string): ParsedPage {
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 300);
  const clean = sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "a", "img", "br", "div", "span", "strong", "b", "em", "dl", "dt", "dd", "section", "article", "main", "figure", "figcaption", "sup", "sub"],
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "data-src", "data-original", "data-lazy-src", "srcset"] },
    allowedSchemes: ["http", "https"], allowProtocolRelative: true,
    nonTextTags: ["script", "style", "noscript", "textarea", "option", "template", "svg", "form", "iframe", "head"],
  });
  const links: ParsedPage["links"] = []; const documents: ParsedPage["documents"] = []; const seen = new Set<string>();
  for (const m of clean.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[0], "href"); const url = href ? normalizeUrl(href, pageUrl) : null; if (!url || seen.has(url)) continue; seen.add(url);
    const text = stripTags(m[1]).slice(0, 200) || attr(m[0], "title") || "";
    (isDocumentUrl(url) ? documents : links).push({ url, text });
  }
  const images: ParsedPage["images"] = []; const seenImg = new Set<string>();
  for (const m of clean.matchAll(/<img\b[^>]*>/gi)) {
    const set = attr(m[0], "srcset"); const largest = set?.split(",").map((s) => s.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] ?? "0") - parseFloat(a[1] ?? "0"))[0]?.[0];
    const src = attr(m[0], "data-src") ?? attr(m[0], "data-original") ?? attr(m[0], "data-lazy-src") ?? largest ?? attr(m[0], "src");
    const url = src && !src.startsWith("data:") ? normalizeUrl(src, pageUrl) : null; if (!url || seenImg.has(url)) continue; seenImg.add(url);
    images.push({ url, alt: (attr(m[0], "alt") ?? "").slice(0, 200) });
  }
  const text = decode(clean
    .replace(/<\/(td|th)>/gi, " | ").replace(/<\/(tr|p|div|li|h[1-6]|dt|dd|section|article|figure|figcaption|table)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").replace(/\s*\|\s*$/, "").trim()).filter(Boolean).join("\n").slice(0, 60000);
  const hash = createHash("sha256").update(text).update(JSON.stringify(images)).update(JSON.stringify(documents)).digest("hex");
  return { title, text, links, images: images.slice(0, 80), documents: documents.slice(0, 60), hash };
}

/** The text sent for extraction: page text plus the exact image and document URLs that may be used (nothing else is accepted). */
export function extractionInput(url: string, p: Pick<ParsedPage, "title" | "text" | "images" | "documents">) {
  return [`URL: ${url}`, `TITLE: ${p.title}`, "", "PAGE TEXT:", p.text, "",
    "IMAGES ON THE PAGE (url | alt text):", ...p.images.map((i) => `- ${i.url} | ${i.alt}`), "",
    "DOCUMENT LINKS ON THE PAGE (url | link text):", ...p.documents.map((d) => `- ${d.url} | ${d.text}`)].join("\n").slice(0, 80000);
}
