# Build status & verification record

What exists, how it was checked, and what is **not** done. Nothing here is claimed without a test behind it.

## How it was tested

| Layer | Method | Result |
|---|---|---|
| Database (schema, RLS, stock, orders, RFQ, reports, storage policies) | `supabase/tests/rls_and_stock.sql` run against a real **PostgreSQL 16** with the four migrations + seed applied, acting as `anon`, a customer and an admin | 25 scenarios pass (see list below) |
| API security | `web/scripts/security-check.mjs` — 73 probes against a live PostgREST API as anonymous visitor and as an ordinary customer | all denials hold (storage checks are covered by the SQL tests because the sandbox mock does not enforce storage policy) |
| Application | Real Chromium (Playwright) driving the Next.js app (dev **and** production build with the CSP active) against PostgreSQL + PostgREST, with a minimal stand-in for Supabase Auth/Storage | import → publish → price/stock → banner → storefront → customer checkout → guest RFQ → quote → PDF → accept → convert → ship → pay → invoice, plus a 40-route smoke test in both languages |
| Static checks | `tsc --noEmit`, `eslint` (0 errors), `next build` | clean |

**Not tested here (needs your real accounts):** actual Supabase Auth emails (confirmation, invite, reset), Supabase Storage policy enforcement in the hosted service (the policies themselves are tested in SQL), Vercel deployment, a payment gateway, and real browsers on phones. The setup guide’s Step 9 checklist covers these.

## Database tests (all pass)
T1 anon sees only published products · T2 costs invisible · T3 internal stock function locked · T4 anon cannot order · T5 no self-promotion to admin · T6 profile isolation · T7 stock tables hidden · T8 order priced from the database (VAT 15%) · T9 **overselling blocked** · T10 cost snapshot hidden · T11 no direct order insert · T12 customers cannot read each other’s orders · T13–T15 reserve → ship (stock out) → cancel (release) · T16 invoice issued and immutable · T17 guest RFQ → quote → convert · T18 invalid RFQ rejected · T19 analytics counters · T20 dashboard staff-only · T21 search/filters/facets · T22 customer accepts a quotation (once) · T23 reports staff-only · T24 storage write policies · T25 RFQ spam throttle.

## Phase checklist

| # | Phase | State |
|---|---|---|
| 1 | Project setup & database architecture | ✅ done, tested |
| 2 | Customer storefront (EN/AR, RTL, mega menu, search with suggestions, filters, product pages, cart, accounts, RFQ, WhatsApp, SEO) | ✅ done, tested |
| 3 | Catalogue extraction & import review | ✅ done, tested (55 PDF families + 60 earlier-extraction items staged; nothing auto-published) |
| 4 | Product & category management (editor, variants, attributes, images, documents, bulk price, CSV/XLSX import/export, duplicate-SKU detection) | ✅ done, tested |
| 5 | Inventory (in/out/adjust, ledger, reservations, valuation, margin, warehouses, low-stock) | ✅ done, tested |
| 6 | Banners (desktop/mobile, placements, Saudi-time schedule, order, impressions/clicks) | ✅ done, tested |
| 7 | RFQ, cart, orders (quotation pricing, PDF, accept, convert, payments, shipments, VAT invoice PDF) | ✅ done, tested |
| 8 | Analytics & reports (real events, sales/product/category/RFQ/banner/stock reports, CSV export) | ✅ done, tested |
| 9 | Security testing & deployment (RLS, headers/CSP, throttling, security probe, setup guide) | ✅ done; deployment itself is yours (guide) |

## Known limitations (honest list)
1. **No prices, SKUs, stock, certifications or availability were invented.** Every imported product is a *draft, quote-only family*. You must add real data.
2. **Catalogue images are 150–475 px crops** and are flagged *low-res*. Replace them with originals before launch.
3. **The uploaded PDF has 10 pages, not 16.** It does not contain copper/HDPE/PVC/cast-iron pipes, forged-fitting types or instrument valves; those appear only in the 60-item “earlier extraction” batch, flagged *not in uploaded PDF*. Confirm them against your 16-page original.
4. **Third-party branding found in the catalogue** (Stable Way Trading, Barakah Valves Trading, a gauge dial brand) is flagged and never used as site branding.
5. **Arabic text is a draft translation**; static legal pages (Privacy/Terms) are templates. Both need human/legal review.
6. **ZATCA**: invoices are PDF VAT invoices only. Not ZATCA-compliant e-invoices (no QR, XML, certificate, clearance). The database is *prepared*, nothing more.
7. **Payments**: bank transfer and cash on delivery only (recorded manually). The gateway architecture is documented; no gateway is connected.
8. **Emails**: auth emails come from Supabase (configure SMTP). The shop does not send quotation/order emails automatically.
9. **PDF documents are English-only** (built-in fonts); Arabic characters typed by customers print as “?”. Embedding an Arabic font with proper shaping is a future task.
10. **Analytics** are first-party and anonymous (distinct browser sessions, no IP). `track_event` is callable by anyone, so counts are indicative, not tamper-proof.
11. **Stock on RFQ-converted orders is not auto-reserved** (items are often made-to-order); staff adjust stock manually.
12. Shipping cost is not calculated automatically (“freight quoted separately”); a shipping amount can be added in a later iteration.
13. **Next.js 16 note:** `cacheComponents` was deliberately turned off so that admin edits appear immediately via on-demand revalidation.
