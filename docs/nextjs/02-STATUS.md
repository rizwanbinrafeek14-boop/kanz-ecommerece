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
T1 anon sees only published products · T2 costs invisible · T3 internal stock function locked · T4 anon cannot order · T5 no self-promotion to admin · T6 profile isolation · T7 stock tables hidden · T8 order priced from the database (VAT 15%) · T9 **overselling blocked** · T10 cost snapshot hidden · T11 no direct order insert · T12 customers cannot read each other’s orders · T13–T15 reserve → ship (stock out) → cancel (release) · T16 invoice issued and immutable · T17 guest RFQ → quote → convert · T18 invalid RFQ rejected · T19 analytics counters · T20 dashboard staff-only · T21 search/filters/facets · T22 customer accepts a quotation (once) · T23 reports staff-only · T24 storage write policies · T25 RFQ spam throttle · T26 social links / contact widget / certifications (anon sees only active ones, expired certifications hidden, only staff can write, `http://` and `javascript:` URLs rejected) · T27 certifications: only administrators can write, the public sees only published, unexpired certifications and only **verified** product assignments of published products, bad status/URL/scope rejected, deleting a certification removes its assignments · T28 slug changes create (and flatten) redirects, anonymous visitors cannot write them, phone/datasheet events are recorded and unknown events ignored. · T35 search: words in any order, synonyms (sw → socket weld), 1 1/2" / 1½ inch, option values, zero-result searches logged, search report staff-only. · T36 images: file names matched by SKU / variant SKU / manufacturer code / slug (separators and one view suffix like _2 or (3) handled, 2 products = ambiguous), staff only; replacing keeps the image row (main flag, alt text, options), moves the social / family image, keeps the previous file, never reports a shared catalogue drawing as deletable, enforces the product folder. · T37 website catalogues: the crawl manifest is staff only, one product per manufacturer + source (page + model), linked documents https only, a website source needs a start URL.

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
- One card per family everywhere (migration 0016): shop, categories, search, suggestions, homepage sections, related products; counts/filters/pagination count families; admin Preview/Apply automatic grouping (exact matches only, two or more brands). Verified on all five catalogues loaded together: 110 published manufacturer products -> 87 shop entries (13 families published automatically); SQL test T32.

## Added later: material classification and filters (migration 0017)
- **Before this change** materials lived in three unconnected places: free-text `material` / `grade` attributes (older Kanz import, e.g. "Carbon steel"), the unused `material` / `grade` text columns on variants, and the catalogue grade lists in `products.specs.materials` (Benkan: per-product production range + a general KIKOH list; JD Delcorte: a general "non exhaustive" list; Bothwell / Mega: none). No variant carried a material.
- **Now:** `material_types` (CS, SS, AS, DSS, SDSS, NI, GI, CI, Brass, Bronze, Cu, Al, HDPE, PVC, CPVC, PPR, Other + custom types) and `product_materials` per manufacturer offering (exact grades, status auto / unverified / verified / rejected, detection source); optional `product_variants.material_code`. Existing explicit `material` attribute values are carried over by the migration.
- Automatic detection (Admin → Materials, and after catalogue import): ASTM grade map + explicit material names → shown; general catalogue lists and description keywords → "not verified" (hidden) until approved; galvanized = coating (GI, base steel in the note); conflicts and missing grades reported; admin decisions are never overwritten.
- Shop: Material, Brand, Size, Connection and Pressure-class filters on all products, categories, search and new brand pages (`/brand/<slug>`); a product or family is listed only when one real variant meets every selected condition; counts are listing entries (a family once); material badges on cards with the active filter highlighted and `?material=` carried to the product page; Material → Brand → Grade → size/class/connection selectors on family and product pages; quote and cart lines record material and grade.
- Verified: 43 browser checks (detection, report, bulk edit, approve / reject, re-detection keeps decisions, custom type, filters incl. no cross-variant matching, card badges, family / product selectors, quote line, brand page, mobile, Arabic) + SQL test T33; families, listing, grouping, gate and SEO suites re-run green.
- **Caveat:** the catalogues give materials per product, not per size, so availability is offering-level unless you set a material on individual variants. Bothwell and Mega list no materials (Material Not Verified); JD Delcorte's and Benkan KIKOH's lists are general and wait for your approval.

## Added later: gaskets & sealing products (migration 0018)
- Gasket catalogue (HTML) imported with a repeatable tool (`web/scripts/gasket-import`): 8 product families, 1,714 configurations, 16 dimension tables (1,598 rows), 29 drawings (all 37 catalogue SVGs) from the catalogue SVGs; category "Gaskets & Sealing Products".
- New: configuration choices on product pages (winding / filler / ring materials, sheet, thickness …) written into enquiries; materials per component; drawings per option; flange-standard filter matched on the same configuration as size and class; "not applicable" options hidden; Technical tab in admin (tables, choices, specifications); import review box.
- Verified: 57 browser checks (filters, option rules, dimensions per standard, drawings, enquiry with specification and quantity, RFQ, WhatsApp, datasheets, mobile, Arabic, admin edits) + SQL test T34; materials, listing, families, gate and SEO suites re-run green.
- Not live until the migration and package are run on Supabase and the products are published.

## Added later: UX review round (migration 0019) — see `08-UX-AUDIT.md`
- Search: words in any order, sizes and codes normalised (½, inch, °, "A 105", "R 24", "BX-155"), common trade synonyms (SW, NPT, WN, RTJ…), ranked by relevance; no-result page shows the closest products and an RFQ prompt; searches with no results listed in Admin → Reports.
- Product page (all products): "Your selection" panel with the exact dimension row, key facts, overview cards (seals / applications / confirm before ordering), no empty approvals block, configurations list collapsed, keyboard-focusable tables, phone floating button no longer covers the sticky bar.
- Spiral wound gasket: interactive layered SVG (exploded / assembled, flange-joint view) and an optional 3D view loaded only on request; dimensions only from the catalogue tables, labelled "Illustrative — not to scale".
- Admin: Technical tab → "Product page overview and visual".
- Verified locally: product-page browser checks (desktop / phone / Arabic, axe, reduced motion, no WebGL, enquiry contents, admin save) + T35; all earlier suites re-run. Not live until 0019 is run and the site redeployed.

## Added later: product images (migration 0020) — see `09-PRODUCT-IMAGES.md`
- Catalogue imports never wait for photos. Each product gets, in order of preference:
  1. its own catalogue picture, credited "Image from the manufacturer's catalogue";
  2. otherwise its dimensional drawing;
  3. otherwise a labelled "Photo coming soon" placeholder drawing of its product type (never an unrelated picture).
- Images are stored separately from products. "Upload / Replace product image" is on every product (Images tab and product list row):
  - replacing keeps the image row and all product data;
  - the previous file can be restored;
  - the new image is live immediately on listings, the product page, search suggestions, the quote list and structured data.
- Bulk upload (Products → Product images): files are matched by SKU, variant SKU, manufacturer code / reference, slug or name. You can choose main or extra image, limit an image to one configuration, or assign unmatched files by hand.
- Photos are optimised in the browser before storage: upright, ≤ 2000 px, WebP, plus a 600 px thumbnail. For example, a 4.1 MB camera JPEG is stored as 858 KB, with a 10 KB thumbnail.
- Verified locally:
  - 69 browser checks (`images.mjs`): placeholder EN/AR, catalogue credit, upload / replace / restore, product data unchanged (variants, stock, attributes, materials), storefront refresh, shared drawings kept, placeholder override, list filter, bulk matching and upload, axe, mobile;
  - SQL test T36;
  - catalogue import re-run, including the drawing fallback.
- Not live until 0020 is run and the site redeployed.

## Added later: manufacturer website import (migration 0021) — see `10-WEBSITE-IMPORT.md`
- Admin → Catalogue → **Import from a manufacturer website**:
  - **Crawl:** robots.txt and Crawl-delay respected, at least 2 s between requests, same site only, no private addresses, resumable, with a URL manifest showing each page's status, HTTP result and error.
  - **Extract:** Claude reads product pages and takes only the values on the page; image and document links must appear on the page.
  - **Review, approve, import:** products become unpublished drafts marked "Catalogue item — request a quotation", with no prices or stock.
- Images and PDFs are copied only with a recorded reuse permission. Otherwise images stay as review links (placeholder shown) and datasheets link to the manufacturer's file.
- Re-running an import never duplicates anything (source key per manufacturer). Changed manufacturer pages appear as updates with a field-by-field preview. Updates change only descriptions, specifications, standards, materials and documents, and each one is written to the audit log.
- Exports: the URL manifest as CSV (error report); Excel with a "Website pages" sheet and a "Problems" sheet.
- **GALA:** not imported yet — www.gala-valves.com was unreachable from the development environment (network policy). Nothing GALA-specific has been invented.
- Verified locally:
  - 73 browser checks against a fictional test site, with a stand-in for the Claude API;
  - SQL test T37.

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
