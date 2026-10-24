/**
 * One public address only: https + the host in NEXT_PUBLIC_SITE_URL (www or not). Returns the URL to redirect (308) to, or null.
 * Disabled for localhost/preview URLs so development and test servers keep working.
 */
export function canonicalRedirect(requestUrl: string, hostHeader: string | null, protoHeader: string | null, site: string | undefined): string | null {
  if (!site) return null;
  let want: URL; try { want = new URL(site); } catch { return null; }
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(want.hostname) || want.hostname.endsWith(".vercel.app")) return null;
  const host = (hostHeader ?? "").split(":")[0].toLowerCase();
  const apex = want.hostname.replace(/^www\./, "");
  const knownVariant = host === apex || host === `www.${apex}`;
  if (!knownVariant) return null;                       // another hostname (preview, IP): leave alone
  const proto = (protoHeader ?? "").split(",")[0].trim();
  if (host === want.hostname && proto !== "http") return null;
  const u = new URL(requestUrl);
  return `${want.protocol}//${want.host}${u.pathname}${u.search}`;
}
