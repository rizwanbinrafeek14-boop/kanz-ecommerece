import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const isProd = process.env.NODE_ENV === "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
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

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
