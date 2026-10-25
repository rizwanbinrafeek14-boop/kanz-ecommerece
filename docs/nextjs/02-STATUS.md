# Build status & verification record

What exists, how it was checked, and what is **not** done. Nothing here is claimed without a test behind it.

## How it was tested

| Layer | Method | Result |
|---|---|---|
| Database (schema, RLS, stock, orders, RFQ, reports, storage policies) | `supabase/tests/rls_and_stock.sql` run against a real **PostgreSQL 16** with the four migrations + seed applied, acting as `anon`, a customer and an admin | 28 scenarios pass (see list below) |
| API security | `web/scripts/security-check.mjs` — 73 probes against a live PostgREST API as anonymous visitor and as an ordinary customer | all denials hold (storage checks are covered by the SQL tests because the sandbox mock does not enforce storage policy) |
| Application | Real Chromium (Playwright) driving the Next.js app (dev **and** production build with the CSP active) against PostgreSQL + PostgREST, with a minimal stand-in for Supabase Auth/Storage | import → publish → price/stock → banner → storefront → customer checkout → guest RFQ → quote → PDF → accept → convert → ship → pay → invoice, plus a 40-route smoke test in both languages |
| Static checks | `tsc --noEmit`, `eslint` (0 errors), `next build` | clean |

**Not tested here (needs your real accounts):** actual Supabase Auth emails (confirmation, invite, reset), Supabase Storage policy enforcement in the hosted service (the policies themselves are tested in SQL), Vercel deployment, a payment gateway, and real browsers on phones. The setup guide’s Step 9 checklist covers these.

## Database tests (all pass)
T1 anon sees only published products · T2 costs invisible · T3 internal stock function locked · T4 anon cannot order · T5 no self-promotion to admin · T6 profile isolation · T7 stock tables hidden · T8 order priced from the database (VAT 15%) · T9 **overselling blocked** · T10 cost snapshot hidden · T11 no direct order insert · T12 customers cannot read each other’s orders · T13–T15 reserve → ship (stock out) → cancel (release) · T16 invoice issued and immutable · T17 guest RFQ → quote → convert · T18 invalid RFQ rejected · T19 analytics counters · T20 dashboard staff-only · T21 search/filters/facets · T22 customer accepts a quotation (once) · T23 reports staff-only · T24 storage write policies · T25 RFQ spam throttle · T26 social links / contact widget / certifications (anon sees only active ones, expired certifications hidden, only staff can write, `http://` and `javascript:` URLs rejected) · T27 certifications: only administrators can write, the public sees only published, unexpired certifications and only **verified** product assignments of published products, bad status/URL/scope rejected, deleting a certification removes its assignments · T28 slug changes create (and flatten) redirects, anonymous visitors cannot write them, phone/datasheet events are recorded and unknown events ignored.

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

## Added later: grooved fittings from supplier MTCs
`scripts/build_mtc_import.py` read the 22-page mill-test-certificate bundle (324 certificate rows) and produced 23 draft product families with the sizes seen on the certificates and the pages each appears on. Rows the scan's text layer garbled were checked against the page images (e.g. 5" sizes, 8"×3" reducer, 8"×2" threaded mechanical tee). Test values, lot codes and the manufacturer's name were intentionally not imported. The PDF is attached privately by staff, never committed (the repository is public). Verified in the browser: 23 draft products, one shared private file, zero public documents, zero variants/prices/SKUs.

## Added later: UI/UX upgrade (your “improve the UI/UX” brief)
Decisions you made: keep the journey exactly as is (RFQ, cart, checkout, accounts) and only improve the look; premium corporate style with subtle animation; keep the homepage sections; filter chips; product-page upgrades A–F; expandable contact button; no external service and no cost.

| Area | What changed |
|---|---|
| Look & feel | Larger type scale, calmer spacing, rounded cards with soft shadows, dark hero with subtle grid, refined category and product cards, darker success green for contrast |
| Motion | Gentle fade-up on scroll and small hover lifts. **All of it is switched off when the visitor’s device asks for reduced motion** (CSS rule + the scroll effect checks the setting) |
| Accessibility | “Skip to content” link, 3 px focus ring (white on dark areas), tap targets ≥ 44 px on phones, labelled icon buttons, `aria-expanded` menus, Escape closes the contact menu/lightbox. Automated axe-core (WCAG 2.1 A/AA) run on the home page (EN/AR), a product page and a filtered listing: 0 violations |
| Listing | Active filter chips (click to remove one), “Clear all”, and a clearer “Sort by” control that shows the current choice |
| Product page | Image lightbox with 2.5× zoom and keyboard arrows; certification badges (only ones you enter, linked to the document, hidden automatically after expiry); sticky enquiry bar on phones; WhatsApp message with product name, SKU, size/grade, quantity and page URL; **availability wording is honest**: “Stock confirmed (N available)” only when the system holds stock, otherwise “Availability on request”; a prominent “Documents” box |
| Admin → Social & contact | WhatsApp/Contact button: enable, number (international format, normalised), default message EN/AR, placement left/right, desktop/mobile visibility, labels and accessible description, optional Call action, custom icon (official icon by default), live preview. Social links: add/edit/reorder/enable/disable/delete for Instagram, Facebook, LinkedIn, X, YouTube, TikTok, Snapchat and custom; built-in or uploaded icon; choose Header / Footer / Mobile menu / Floating menu per link; preview before saving |
| Admin → Certifications | Create real certifications (issuer, number, expiry, document), attach them per product (new “Certifications” tab) |
| Validation | URLs must be `https://` and on the platform’s own domain (use “Custom” otherwise); icons must be PNG/WebP/SVG ≤ 512 KB and are checked by content, not by file name; SVGs are cleaned (scripts, event handlers, links and external references are rejected) and all icons render in a fixed square so proportions are kept |

Verification: 51 automated browser checks (admin creates/rejects links and icons, storefront shows them, left/right placement, mobile-only/desktop-only, WhatsApp on/off, mobile overflow at 390 px in EN/AR, reduced motion, sticky bar vs floating button, keyboard skip link, axe) plus SQL scenario T26 and extra API probes (anonymous visitors cannot create links/certifications or change the WhatsApp number).

**Not claimed:** no reviews, ratings, customer counts, delivery promises or certifications were added. The cookie question: the site only uses anonymous first-party counting and no third-party cookies, so no cookie banner was added; keep the Privacy page linked and have a lawyer confirm.

## Added later: Quality & Certifications (migration 0011)
- **Public page `/quality`** (EN/AR, linked from the header, mobile menu and footer): editable “Quality Assurance” text, an “Awards & Certifications” grid (logo above a red “View Certificate” button), and a navy banner with white logo cards (6 per row on desktop, 3 tablet, 2 mobile; logos keep their proportions). The default wording says KANZ CORNER is a supplier/trader and does not manufacture; edit it under Admin → Certifications → Quality page text.
- **Admin → Certifications (administrators only):** create, edit, reorder, publish/unpublish and delete certifications with name (EN/AR), official logo upload (PNG/WebP/SVG ≤ 512 KB), description, certificate PDF (≤ 10 MB) or an https verification URL, number, issuer, holder/manufacturer, scope, issue/expiry dates and “show on Quality page”. Deleting one that is assigned shows how many products lose it. Nothing is pre-filled.
- **Product editor → “Certifications” tab (administrators):** search and add certifications; per product set the status (Verified / Pending verification / Not available / Not applicable), an approval number, a product-specific PDF or URL, a scope note and the exact variants/sizes it applies to. Existing assignments from migration 0010 become *Pending* until you verify them. A company or manufacturer certificate is never applied to a product automatically.
- **Product page:** logo row under the action buttons and an “Approvals” section, both from the same data; only Verified + published + unexpired + applicable-to-the-selected-size approvals appear; links open the product’s own PDF/URL first, then the certificate’s. Nothing verified → no badges and the message “Certification information not available. Please contact us for details.”
- Verified with 60 automated browser checks (create/edit/reorder, validation, assignments persisting after refresh, size-limited badges, unpublish/expire/delete effects, fallback text, Arabic RTL, mobile overflow, axe 0 violations).

## Added later: SEO for English and Arabic (migration 0012)
Implemented and verified locally (81 automated checks): unique titles/descriptions, canonical + hreflang (+ x-default) on every public page, noindex on filter/sort/search URLs and on pages without genuine content (untranslated Arabic products, empty categories), live sitemap, robots.txt, real 404s, automatic permanent redirects when a product/category slug changes, non-www/http → canonical host redirect (active on your real domain), LocalBusiness + BreadcrumbList + Product JSON-LD without invented prices/ratings/availability, category buying guides (EN/AR), richer Contact page, alt text per language, admin SEO controls with an approximate preview, Search Console verification field, and first-party counts of phone clicks and datasheet downloads. **Not verified here:** Google indexing, Rich Results Test, Search Console, Business Profile, real-world speed, Arabic copy quality. See `docs/seo/` (guide, keyword map, redirect map, Business Profile checklist, 30/60/90-day plan).

## Added later: homepage redesign ("Blueprint" + "Spec Sheet", migration 0013)
- Engineering-drawing look: drafting-grid hero, IBM Plex Sans / Plex Mono / Plex Sans Arabic (self-hosted; Inter and Cairo removed), steel-grey neutrals with the brand red.
- Hero: headline with a dimension line, an SVG flanged joint that draws itself and opens into an exploded view on scroll, and a title-block search with tabs (Product with live suggestions and keyboard support, Size, Standard, Material, each optionally limited to a category). Counters show only real database counts.
- Numbered "drawing sheet" sections with a sticky "On this page" index on wide screens; category sheets with line icons, sub-category chips and real product counts (or "Quotation on request"); browse by material/standard (from real data only); products by sector; featured products; certificates strip (published only); 3-step quotation explainer; "Why us" rewritten without the unverified "certified manufacturers" claim; recently viewed (browser only); final CTA with a magnetic button.
- Admin banners still work (new "Promotion banners" block under the hero). All sections can be reordered/disabled in Content & settings.
- Verified: 46 homepage checks (search tabs/keyboard/suggestions, real counters, reduced motion, mobile 390 px, Arabic RTL, axe 0 violations, CLS 0) plus the full SEO (81), social/contact (51) and certifications (60) suites re-run green.

## Added later: catalogue extraction & import (migration 0014)
- **Admin → Catalogue import:** upload a manufacturer PDF (private bucket), render its pages in the browser (scanned JPX pages and Japanese fonts included), extract with Claude vision (optional `ANTHROPIC_API_KEY`, live cost display, page-by-page with stop) or load a checked `kanz-catalogue-extraction/1` file, review each product beside its source page (options, variants, dimension tables, standards, materials, drawing crops), validate (errors block approval), detect duplicates, approve, and import atomically as unpublished quote-only drafts. Export to JSON/CSV/Excel. Guide: `docs/nextjs/04-CATALOGUE-IMPORT.md`.
- **Data model:** product families (shared across manufacturers), product options/values, variants with option values, manufacturer code, weight and source page, dimension tables/rows, per-product standards/materials/applications. Public read only for published products.
- **Product page:** dependent selectors (only real combinations can be chosen), Dimensions tab with the selected size highlighted and the drawing credited to the manufacturer catalogue, Materials & standards, Applications, variants table with weights, and a per-variant English datasheet PDF (`/api/datasheet/[slug]?variant=`).
- **Batch 1 (Bothwell, 6 pages):** extracted by hand into a review file (not in the repository): 15 products, 557 variants, 177 dimension rows, 6 drawings. 90° elbow, tee and full coupling have full ASME B16.11 dimension tables; the other 12 items carry weights only and are flagged. Reducing couplings were not created (ambiguous sizes). Verified end to end in the browser: upload → render → load → review → approve → import → publish → selectors/dimensions/datasheet, plus SQL tests T29–T30.
- **Not yet done:** Mega, Thai Benkan, Benken and Delcorte batches; no live Claude extraction was run here (no API key in the test environment).

## Added later: datasheets for signed-in customers only
- The generated datasheet (`/api/datasheet/[slug]`) and every uploaded public product document (`/api/document/[id]`) are served only to signed-in users; anyone else is sent to sign-in / create account with an explanation and returned to the product page afterwards (the return address is checked so it cannot point to another site). The product page shows "Free account required" next to download links, and no longer exposes the storage URL of uploaded documents.
- Limitation: files in the public `product-docs` bucket can still be opened by anyone who already has the exact file address (for example, one shared before this change). Their addresses are no longer published on the site.

## Added later: multi-brand product families (migration 0015)
- One product page per product type with a manufacturer selector (Bothwell / Mega / JD Delcorte / Benkan …). Each brand's offering keeps its own configurations, dimension tables, drawings, documents and manufacturer codes; switching brands keeps compatible choices and explains any change; Compare brands (up to 3) compares only matching configurations and says "Not offered" / "No data" otherwise. Quote and cart lines record the exact brand offering and SKU.
- Admin → Product families: match suggestions (exact / likely / uncertain with reasons; nothing linked automatically), family page editor (EN/AR, own photo, SEO, publish), offering confirm / keep separate / reorder / link / unlink.
- SEO: one canonical page per family, ProductGroup JSON-LD, brand pages 308-redirect to the family when confirmed, sitemap lists families instead of their offerings, family renames keep old addresses.
- Delcorte is displayed as "JD Delcorte" (owner's decision).
- Verified: 33 browser checks (suggestions, confirm, publish rules, slug clash, redirects, brand switching with carried selections, per-brand dimensions and drawings, compare, enquiry line, sitemap, Arabic mobile, unpublish) + SQL tests T31; SEO, catalogue-import and SQL suites re-run green.
- Not done yet: category/search listings still show one card per brand offering (they link to the family page via the redirect).

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
13. Contact/social changes appear on the website within about a minute (cached pages refresh on a 60-second cycle, and immediately after the next request following a save).
14. **Next.js 16 note:** `cacheComponents` was deliberately turned off so that admin edits appear immediately via on-demand revalidation.
