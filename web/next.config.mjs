// Plain JavaScript (not next.config.ts) so Node loads it directly: a TypeScript config has to be compiled first, which
// fails on build hosts where Next's native compiler cannot run (e.g. Hostinger: system glibc older than 2.29).
import supabaseEnv from "./supabase-env.cjs";

const { resolveSupabaseEnv } = supabaseEnv;

// Supabase settings from this app's variable names or from Hostinger's Supabase integration (SUPABASE_URL / SUPABASE_API_KEY).
// Only the URL and a PUBLIC key are passed to the browser; a secret key is never exposed (see supabase-env.cjs).
const sb = resolveSupabaseEnv();
for (const note of sb.notes) console.warn(`[supabase] ${note}`);
const supabaseHost = sb.url ? new URL(sb.url).hostname : undefined;

const isProd = process.env.NODE_ENV === "production";
const supabaseOrigin = sb.url ? new URL(sb.url).origin : "";
// Content-Security-Policy (production only; dev tooling needs eval/websockets). Scripts allow 'unsafe-inline' because Next.js injects
// inline bootstrap scripts; everything else is locked to this site and the Supabase project. WhatsApp links are plain navigations.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}`,
  "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join("; ");
// The admin catalogue importer renders PDFs in the browser with PDF.js, whose image decoders are WebAssembly.
const adminCsp = csp.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");

/** Link header for the homepage: site summary for language models, the Markdown version, the MCP server card and sitemap. */
const homeLink = (lang) => [
  `</llms.txt>; rel="describedby"; type="text/plain"`,
  `</md/${lang}>; rel="alternate"; type="text/markdown"`,
  `</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"`,
  `</sitemap.xml>; rel="sitemap"; type="application/xml"`,
].join(", ");

/** @type {import("next").NextConfig} */
const nextConfig = {
  // the public Supabase settings, whichever names the host provides them under
  env: { ...(sb.url ? { NEXT_PUBLIC_SUPABASE_URL: sb.url } : {}), ...(sb.anonKey ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: sb.anonKey } : {}) },
  // Small hosts (e.g. Hostinger Node.js apps) limit processes/memory during build: keep the build single-worker.
  experimental: { cpus: 1, serverActions: { bodySizeLimit: "4mb" } },
  // exceljs is loaded by Node at runtime instead of being bundled: its zip reader (unzipper) has an optional, never-used
  // S3 source that requires @aws-sdk/client-s3 only when called, which the bundler would otherwise try to resolve.
  serverExternalPackages: ["exceljs"],
  // Tailwind CSS v4 is compiled through this Turbopack rule (kept from the create-next-app scaffold).
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  // Make the catalogue extraction data available to the server action that loads it into the review screen.
  outputFileTracingIncludes: {
    "/admin/import": ["./data/catalogue-import/**/*"],
    "/api/rfq/[token]/pdf": ["./public/brand/**/*"],
    "/api/invoice/[id]/pdf": ["./public/brand/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
        ],
      },
      ...(isProd ? [{ source: "/admin/:path*", headers: [{ key: "Content-Security-Policy", value: adminCsp }] }] : []),
      // For AI agents (RFC 8288 Link headers): the homepage points at llms.txt, its Markdown version and the MCP server card;
      // catalogue pages point at their Markdown version. "Vary: Accept" because the same URL also answers with Markdown
      // when an agent sends "Accept: text/markdown" (see src/proxy.ts), so caches must keep the two apart.
      { source: "/", headers: [{ key: "Vary", value: "Accept" }, { key: "Link", value: homeLink("en") }] },
      { source: "/:lang(en|ar)", headers: [{ key: "Vary", value: "Accept" }, { key: "Link", value: homeLink(":lang") }] },
      ...["products", "category/:slug", "product/:slug", "brand/:slug"].map((p) => ({
        source: `/:lang(en|ar)/${p}`, headers: [{ key: "Vary", value: "Accept" }, { key: "Link", value: `</md/:lang/${p}>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"` }],
      })),
    ];
  },
};

export default nextConfig;
