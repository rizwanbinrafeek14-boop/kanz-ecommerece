# KanzCorner — UX, product and admin audit (October 2026)

## What was inspected — and what was not
**Inspected directly**
- Source code of branch `claude/practical-thompson-hydw8i`: all storefront and admin routes, components, server actions, migrations 0001–0018, RLS policies.
- A local production build (`next build` + `next start`) on a local Postgres database. The catalogue data loaded there is: Bothwell, Mega, Benkan, JD Delcorte, the reference sheets and the gasket package, plus the families grouped automatically. All products are published.
- Measurements in that build:
  - page weight and server time (curl);
  - DOM size, LCP and horizontal overflow at 1440 px and 390 px (Playwright, Chromium);
  - accessibility (axe-core, WCAG 2 A/AA);
  - search results for 20 real buyer queries (direct `search_products` calls).

**Not inspected**
- **The live site, https://www.kanzcorner.com.** This environment's network policy blocks the host (proxy 403). I could not see the deployed version, its real data, its traffic or Search Console.
- **The live admin screens and the live Supabase data.** The admin was reviewed in code and in the local build only.
- **Real analytics.** No figures in this report are traffic or business data. Speeds are local measurements without network throttling, so they show relative weight, not real-world speed.

Where a finding depends on the live data (for example how many products lack images), it says so.

## A. Executive assessment
The platform has strong foundations:
- one card per product family;
- brand → option pickers that only allow catalogue combinations;
- per-brand dimension tables and drawings;
- configuration choices for gaskets;
- verified-only certification badges;
- bilingual SEO, RLS-protected admin and an audit log.

The biggest obstacles to enquiries are now **finding** and **sending**, not product data:

1. **Search fails on normal buyer phrasing.**
   - `90 elbow`, `socket weld elbow`, `1/2 elbow`, `weld neck` and `spiral wound 4 inch` all return **0 results**, even though matching products exist.
   - Search only matches the exact phrase as a substring.
   - Zero-result searches are not recorded, so nobody notices.
2. **The RFQ cannot carry a drawing.**
   - The database already has `rfq_attachments`, but the form has no upload.
   - The gasket, heat exchanger and insulation-kit pages ask customers to "send the drawing with the enquiry", and there is no way to do that on the site.
3. **Two baskets.** "Quote" and "Cart" sit side by side in the header, and there is a checkout flow, but almost every imported product is quote-only. Customers have to work out which basket to use.
4. **Product pages make engineers dig.**
   - The selected dimensions sit inside a tab below the fold.
   - Nothing states "what this connects to" or "what to confirm before ordering".
   - Empty sections ("Approvals: not available") and repeated "Material not verified" labels add noise.
5. **Admin is built around sales, but the business runs on quotations.**
   - The dashboard leads with revenue charts.
   - It does not show RFQs waiting for a reply, who owns them, or products that cannot be sold well (no image, no material, unreviewed import notes).

## B. Evidence-based audit
| # | Page / workflow | Observed problem | Evidence | Impact | Recommendation | Priority | Effort / deps |
|---|---|---|---|---|---|---|---|
| 1 | Search (all journeys) | Multi-word and spec queries return nothing. | `search_products` uses `name ilike '%'‖q‖'%'` (migration 0018). Measured: "90 elbow" 0, "elbow 90" 0, "socket weld elbow" 0, "SW elbow" 0, "1/2 elbow" 0, "½ elbow" 0, "weld neck" 0, "spiral wound 4 inch" 0, "BX-155" 0 (but "BX155" 1). | Procurement officers who type the spec get an empty page and leave or phone. | Match each word against a normalised search text (name, family, brand, option labels, SKU, manufacturer code, standards, materials). Normalise ½ → 1/2, 1½ → 1-1/2, inch/in/″ → ", 90° → 90, and hyphens in codes. Add a small synonym list (SW ↔ socket weld, NPT ↔ threaded, WN ↔ weld neck, RTJ ↔ ring type joint, kammprofile ↔ camprofile). | **P0** | Medium. One SQL function; no schema change needed. |
| 2 | Search analytics | No-result searches are invisible. | `track("search")` fires only from the header box (`search-box.tsx:42`) and stores no result count. The listing page does not track. | You cannot learn what customers fail to find. | Log query + result count + filters from the listing page. Admin report: top queries and zero-result queries. | P1 | Small. |
| 3 | Listing sort | The "Relevance" option actually sorts by newest. | `listing.tsx:146` maps `newest` → `dict.filters.sort.relevance`. | Misleading. Search results are not ranked by match quality. | Real relevance (name/code match first) when a query exists; otherwise label it "Newest". | P1 | Small (with #1). |
| 4 | Filters | Filter counts ignore the other selected filters. | `product_facets(p_q, p_category, p_brand)` has no filters argument (`catalog.ts:129`). | Shoppers click a value showing "5" and get 0. | Pass the active filters to the facet query, excluding the group being counted. Hide or disable values with 0. | P1 | Medium. |
| 5 | Navigation | Only the first 4 top categories appear in the menu bar. Flanges, Valves and Gaskets are reachable only through "All categories". | `header.tsx:89` uses `tree.slice(0, 4)`. Screenshots show Pipes, Pipe Fittings, Forged Fittings, Copper & Grooved. | Core B2B categories are hidden. | Add a "show in main menu" flag or use sort order chosen by the admin. Keep the mega-menu. | P1 | Small. |
| 6 | Quote vs cart | Two baskets plus checkout, while the catalogue is quote-only. | Header Quote and Cart icons. `cart-view.tsx` shows two lists. All catalogue imports set `is_quote_only = true`. | Confusion. Priced and quote items can't go in one request. | See question 1: an RFQ-first header (one "Enquiry list"), with checkout kept only for priced stock items. | P1 | Medium. |
| 7 | RFQ | No attachments. | Table `rfq_attachments` (0002_commerce.sql:231) is never referenced in `web/src`. `rfq-form.tsx` has no file input. | Made-to-drawing gaskets, heat exchanger gaskets and insulation kits cannot be quoted online. | Upload PDF/DWG/image (private bucket, size and type limits) on the RFQ and per line. Show them in the admin RFQ view. | **P0** | Medium. Needs a storage bucket policy. |
| 8 | RFQ | The paste list exists, but there is no spreadsheet upload and no match to catalogue items. | `rfq-form.tsx:25-35` parses pasted rows only. | Contractors with 40-line lists retype them. | XLSX/CSV upload (exceljs is already installed), a review table with suggested catalogue matches, then submit. | P2 | Medium. |
| 9 | Returning customer | No way to repeat an enquiry. | `account/quotes/page.tsx` lists RFQs only. | Repeat buyers re-enter everything. | "Repeat this enquiry" copies lines into the enquiry list for editing. Saved lists are optional. | P1 | Small. |
| 10 | Product page | No summary of what it is, what it connects to, or what to confirm. The selected dimensions are hidden in a tab. The desktop left column is empty below the gallery. The "Approvals: not available" block always shows. "Material not verified" repeats on every brand card. | Screenshot (desktop, 1440 px). `family-view.tsx`, `approvals.tsx`. | Engineers scroll and switch tabs to check one dimension. Empty blocks look unfinished. | New product page (section C). Key dimensions for the selection next to the drawing. Hide empty approval sections. | P1 | Medium. |
| 11 | Mobile product page | The floating "Contact us" button covers the brand-selector heading. The sticky enquiry bar and the floating button stack on top of each other. | Mobile screenshot at 390 px. | Hidden controls, accidental taps. | Hide the floating button on product pages (the sticky bar already has WhatsApp and Quote). | P1 | Small. |
| 12 | Page weight | Gasket and large-family pages are heavy. | Spiral wound: 1.2 MB HTML (120 KB gzip), 839 table rows, 784 KB RSC payload. Forged elbow: 350 KB (55 KB gzip). | Slow on mid-range phones over mobile data. | Load dimension rows for the selected configuration only. Paginate or lazy-load "All configurations". | P2 | Medium. |
| 13 | Accessibility | Gasket page on mobile: `scrollable-region-focusable` (serious). The other pages tested pass axe. | axe run at 390 px. | Keyboard users cannot scroll wide tables. | `tabIndex=0` + `role=region` + label on scrollable table containers. | P2 | Small. |
| 14 | Admin dashboard | Leads with revenue, sales charts and inventory value. Nothing shows quotation workload or data quality. | `admin/(portal)/page.tsx`. | Staff don't see what needs action today. | An "Action needed" dashboard (section D). | P1 | Medium. |
| 15 | Admin RFQs | No owner, no age or SLA, no export. Notes and an event history exist (good). | `rfqs/page.tsx`, `rfq-workbench.tsx`. Schema `rfqs` has no assignee column. | Enquiries get lost between staff. Response time isn't measurable. | `assigned_to`, `first_response_at`, age badge, "my RFQs" filter, CSV export. | P1 | Medium. Additive migration. |
| 16 | Data quality | Many published products lack images or a shown material. | In the local test data: 62 of 118 published products have no image, and 111 have no shown material (detection not yet run). Live numbers are unknown. | Weak cards and filters. | A data-quality queue in the admin (missing image, material, Arabic text, review notes). | P1 | Small. |
| 17 | Import safety | Imports record the product IDs they create, but there is no one-click undo. | `catalogue_import_runs.summary.product_ids`. | A bad import is cleaned up by hand. | "Undo import" that deletes drafts created by a run, only if they are still unpublished and unedited. | P2 | Small. |
| 18 | Analytics | WhatsApp/phone clicks and submitted RFQs are separate events (good). There is no funnel from product view to RFQ. | `track.ts`, `submit_rfq` records `rfq_submit`. | Can't see which products convert. | Report: views → enquiry-list adds → submitted RFQs, per product. | P2 | Small. |
| 19 | Arabic | Product data is mostly bilingual in the test data (118/118 Arabic names). Catalogue descriptions are draft translations. | DB counts. Gasket review notes. | Arabic readers see uneven quality. | Review queue for Arabic text (part of #16). | P2 | Content work. |
| 20 | Permissions | Sound. Staff can delete only drafts (RLS, 0004:352); admin-only role changes; audit log; private MTC bucket; datasheets behind sign-in. | Migrations 0004, 0010, 0015. | — | Keep. Add confirmation text naming what will be deleted (already done for most actions). | — | — |

## C. Proposed customer experience
**Homepage.** Keep the current structure (hero with search, category sheets, RFQ steps). Change:
- the search box placeholder shows real examples ("1/2\" SW elbow 3000, R24, weld neck 6\" 300");
- a visible "Upload your list or drawing" route into the RFQ;
- all core categories in the menu bar.

**Category / search page.**
- Results ranked by relevance when there is a query.
- Filters with counts that respect the other selected filters, and chips with "Clear all" (the chips already exist).
- When nothing matches: show the closest matches (same words without the size or class), plus "Ask us — add this line to your enquiry" pre-filled with the query.

**Product page (one per family)**, top to bottom:
1. **Title, a one-line "what it is", and the brands.**
2. **Configuration**, as one panel: brand → material → connection → size → class (only valid combinations), then configuration choices (gaskets).
3. **Selected configuration, next to the drawing:**
   - SKU or manufacturer code;
   - the key dimensions for this exact brand and size, with symbols that match the drawing;
   - standard;
   - weight where published.
4. **"Connects to"** (pipe end, thread or flange standard) and **"Confirm before ordering"** (from the catalogue notes or the admin).
5. **Enquiry:** quantity + unit, Add to enquiry list, WhatsApp with the full specification, datasheet.
6. **Tabs** for everything else: full dimension table, drawings, downloads, all configurations, standards, applications.
7. **Compare brands** stays, comparing the selected configuration only.

**RFQ journey.**
- One enquiry list, with lines carrying the specification.
- Then a form with: lines (editable qty and unit) · paste or upload a list · attachments · project name, delivery city, required-by date and notes · contact details.
- Then a confirmation with the RFQ number and a status page link. These already exist.
- Signed-in customers can repeat a previous RFQ.

## D. Proposed admin experience
**Navigation, grouped by job:**
- **Today** (dashboard)
- **Enquiries:** RFQs, Orders, Customers
- **Catalogue:** Products, Product families, Materials, Categories, Brands, Attributes
- **Imports:** Catalogue import, Spreadsheet import
- **Media & documents:** Certifications
- **Website:** Banners, Content, Social & contact, SEO
- **Settings:** Users

**"Today" dashboard: only items that need action.**
- RFQs without a reply, oldest first, with age and owner.
- Quotations expiring this week.
- Imported drafts with open review notes.
- Products missing an image, material or Arabic text.
- Zero-result searches from the last 7 days.
- Certificates expiring within 60 days.

Revenue charts move to Reports.

**Key screens to strengthen:**
- RFQ list: owner, age, status, filters, export.
- Product page: the existing tabs plus a "Visual" field set (see E).
- Data-quality queue.

## E. Visualisation strategy
| Product group | Most useful visual | Format | Source assets needed | Complexity |
|---|---|---|---|---|
| Forged / butt-weld elbows, tees, couplings | Dimension callouts that change with brand + size; "how it connects" (socket weld vs threaded) | Interactive annotated SVG drawn from the brand's own dimension table, labelled **Illustrative — not to scale** | The dimension tables (already in the database) | Low |
| Spiral wound / camprofile gaskets | Exploded layers (winding, filler, inner / outer ring) and where the gasket sits in the flange joint | Annotated SVG with an exploded-view animation (reduced-motion aware) | The catalogue SVGs (already uploaded) | Low–medium |
| Flanges | Exploded joint (pipe, flange, gasket, bolts, mating flange); facing types | SVG or lightweight 3D | Verified B16.5 dimensions per size and class (not in the catalogue data yet) | Medium |
| Valves | Cutaway opening and closing by valve type | Short video or 3D from manufacturer models | Manufacturer CAD/GLB or drawings, with permission | High |
| Grooved couplings | Exploded housing, gasket, groove | SVG | Manufacturer drawings | Medium |

**Why SVG first rather than 3D.** The value for engineers is "which dimension is which, for my exact size and brand". A parametric SVG fed by the verified tables:
- delivers that at a few KB;
- works without WebGL;
- is accessible as text and RTL-safe.

Interactive 3D adds rotation but needs a WebGL library (~150 KB+ gzipped, lazy-loaded) and per-family models. Without manufacturer CAD it can only be schematic, so it adds little engineering information for fittings. Recommended rules:
- 3D only on product pages, only after a click, with a poster image;
- manufacturer GLB models are needed where the internal geometry matters (valves).

## F. Roadmap
**Immediate fixes (days):**
- Search word matching, normalisation and synonyms (#1).
- Zero-result logging (#2).
- Sort label (#3).
- Menu categories (#5).
- RFQ attachments (#7).
- Mobile floating-button overlap (#11).
- Table keyboard access (#13).

**High-value functionality (weeks):**
- The new product page (C).
- Facet counts (#4).
- One enquiry list (#6, depends on question 1).
- Repeat RFQ (#9).
- RFQ owner, age and export (#15).
- "Today" dashboard and data-quality queue (#14, #16).
- Elbow and gasket visuals (E).

**Advanced:**
- Spreadsheet RFQ upload with catalogue matching (#8).
- Lighter pages for large families (#12).
- Import undo (#17).
- Conversion reporting (#18).
- Flange visualiser once verified flange dimensions are loaded.
- 3D only where manufacturer models exist.

## G. First implementation round (this branch)
Decisions:
- Keep both the Quote list and the Cart (owner's choice).
- Prototype product: spiral wound gasket.
- Visual: interactive SVG plus an optional 3D view.
- Search fix included.

**Done in this round:**
- **Search (#1, #2, #3).** Migration `0019_search.sql` (additive):
  - word matching against a cached search text per product (`product_search`, kept current by triggers);
  - ½ / inch / ° / code normalisation and synonyms;
  - relevance ranking when there is a query;
  - type-ahead uses the same matching;
  - zero-result searches are logged with their result count (`analytics_events.results`) and listed in Admin → Reports;
  - "Relevance" is shown only when there is a query, otherwise "Newest";
  - no-result page: closest products for the same words without sizes, plus a prompt to add the line to an RFQ.
- **Product page (#10, #11, #13), for every product:**
  - "Your selection" panel next to the drawing, with the exact dimension row for the selected configuration;
  - key facts (size range, classes, standards, styles), taken from the real option values;
  - overview cards: Seals / connects to, Typical applications, Confirm before ordering;
  - Approvals block hidden when there are no verified certificates;
  - "All configurations" collapsed and limited to 100 rows (everything stays selectable);
  - scrollable tables keyboard-focusable;
  - on phones the floating contact button is hidden on product pages (the sticky bar has WhatsApp + quote).
- **Gasket explorer (spiral wound):**
  - SVG cross-section with exploded / assembled and flange-joint views;
  - labels, dimensions and animation toggles;
  - d1–d4 only from the selected row; style-aware (no inner ring for SW-CR, no dimensions for made-to-joint styles);
  - labels show the chosen winding and filler;
  - "Illustrative — not to scale" and a "no compression / stress" disclaimer;
  - reduced motion respected; text alternative; readable on phones.
- **Optional 3D view** (three.js, downloaded only when the customer clicks; about 518 KB uncompressed):
  - diameters from the selected row; thickness exaggeration stated; winding pattern illustrative;
  - rotate / zoom / reset buttons, cutaway, exploded;
  - renders only when something changes; WebGL fallback message.
- **Admin:** Product → Technical → "Product page overview and visual" holds:
  - Seals / connects to (EN / AR);
  - Confirm before ordering (EN / AR);
  - visual type;
  - 3D on/off.

  For products already imported, `3-gaskets-product-page-update.sql` (in the gasket package) adds the spiral wound overview and visual only where they are missing.

**Still open (roadmap above):**
- #4 conditional facet counts;
- #5 menu categories;
- #7 RFQ attachments;
- #8 spreadsheet RFQ;
- #9 repeat RFQ;
- #12 lighter dimension payload;
- #14–#18 admin dashboard, RFQ owner / age / export, data-quality queue, import undo, conversion report.
