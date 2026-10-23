# KANZ CORNER EST. — E-commerce Platform: Architecture & Design Plan

Stack: Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn/ui-style components (Radix) · Supabase (PostgreSQL, Auth, Storage) · Recharts · Vercel.
Location in repo: `web/` (app) and `supabase/` (database). The older WordPress theme in `theme/` is left untouched.

---

## 1. Catalogue analysis (what the PDF actually contains)

`kanz-CATALOGE.pdf` — **10 pages** (the brief mentions 16; the uploaded file has 10. The older WordPress export in `data/products-import.csv` covers more families, see §1.3).

| Page | Content | How it is used |
|---|---|---|
| 1 | Cover, tagline, contact details (+966 50 726 4938, sales@kanzcorner.com, Al-Khobar address) | Company settings (editable) |
| 2 | Vision 2030 message | Homepage / about copy (editable) |
| 3 | About Us | About page copy (editable) |
| 4 | **Pipes**: Carbon Steel ERW, Carbon Steel Seamless, Stainless Steel SMLS/ERW, Duplex — sizes, schedules, grades, standards, supplier brands | 4 product *families* with attributes |
| 5 | **Pipe chart**: Nominal Wall Thickness Schedule table (image) | Attached as a reference document, **not transcribed** (a mis-read number in a wall-thickness table is a safety risk) |
| 6 | **Pipe Fittings**: Stainless, Grooved, Forged (CS/SS), Carbon Steel, PVC-CPVC-PPR, HDPE | 6 families |
| 7 | **Flanges** (8 types) and **Valves** (12 types) | 8 + 12 families |
| 8 | **Fasteners** (12 pictured types) and **Gaskets** (types list) | 12 + 1 families |
| 9 | **Other products** (repair clamp, flange adapter, flexible connector, cam lock, brass fittings, sprinklers, air vent, no-hub coupling, gauges…) | 11 families + Gauges |
| 10 | Back cover, contact details | — |

### 1.1 Rules applied
* Every entry is a **product family**. No price, SKU, stock level, certificate or availability is invented. Families are created as `is_quote_only = true`, `status = draft`.
* Nothing is published automatically. Extracted data goes to `import_items` and is reviewed at **/admin/import**.
* Product images are cropped from the PDF individually (70 candidates) with `scripts/extract_catalogue.py`. They are 150–475 px, so every one is flagged `needs_hires` so staff replace them with originals.

### 1.2 Items flagged for manual review (found in the PDF)
| Flag | Finding | Where |
|---|---|---|
| `foreign_branding` | "STABLE WAY TRADING" Arabic/English logo and "TRADING COMPANY" marks | pp. 4, 5, 9 |
| `foreign_branding` | "BARAKAH VALVES TRADING" + `www.barakahvalves.com` | p. 4 |
| `foreign_branding` | Pressure-gauge photo shows a third-party dial brand ("WINTERS") | p. 9 |
| `verify_specs` | "A 312 Grade TP316" listed under *carbon steel* grades (A312 is a stainless spec) | p. 4 |
| `verify_specs` | Stainless "ASTM A321" — A321 is not a pipe specification; A312/A269/A213 are | p. 4 |
| `verify_specs` | "Schedule : 10,40,,80" (typo / missing value) | p. 4 |
| `verify_specs` | "China" listed as a brand (Duplex) | p. 4 |
| `verify_specs` | Brand lists (Sumitomo, Tubacex, Sandvik…) imply authorised-distributor status — confirm before showing | p. 4 |
| `verify_specs` | "TYPES OF GASKETS:" caption printed under *Other Products*; "Guages" typo; asbestos gaskets listed (regulatory check) | pp. 8–9 |
| `low_res` | All product photos ≤ 475 px | all |
| `not_in_uploaded_pdf` | Items in the older CSV that are not in this PDF (copper, HDPE/PVC pipes, cast iron, forged-fitting detail, instrument valves…) — imported as a **second batch**, all flagged | §1.3 |

### 1.3 Two import batches
1. **Uploaded PDF** (`web/data/catalogue-import/import.json`) — the primary source.
2. **Earlier extraction** (`data/products-import.csv`, 90 rows from the WordPress build). Its `KC-…` codes were invented internal references, so they are **not** used as SKUs (kept as `legacy_ref` in the review note). Only rows that do not exist in the uploaded PDF are loaded, each flagged `not_in_uploaded_pdf`.

---

## 2. Category structure (editable in /admin/categories)

```
1 Pipes ................ Carbon Steel (ERW & Seamless) · Stainless Steel · Duplex · Copper · HDPE · PVC · CPVC · PPR · Cast Iron
2 Pipe Fittings ........ Buttweld · Stainless · Carbon Steel · Duplex · Elbows · Tees · Reducers · Caps & Couplings
3 Forged Fittings ...... Threaded · Socket Weld · Class 2000 · 3000 · 6000 · 9000
4 Copper & Grooved ..... Copper Fittings · Grooved Fittings
5 HDPE/PVC/CPVC/PPR Fittings
6 Flanges ............... Blind · Weld Neck · Slip-On · Socket Weld · Threaded · Lap Joint · Spectacle Blind · Orifice
7 Valves ................ Gate · Globe · Check · Ball · Butterfly · Instrument · Other
8 Fasteners ............. Bolts & Screws · Nuts · Washers · Studs & Rod · Anchors
9 Gaskets & Gauges ..... Gaskets · Gauges
10 Other Industrial ..... Clamps & Adapters · Flexible/Thread Connectors · Brass & Tube Fittings · Sprinklers/Air Vents/Safety
```
Seeded by `supabase/seed.sql` (names in English and Arabic). Categories exist even where the catalogue has no product yet (e.g. Ball Valves) so the structure matches the business; empty categories are shown only if they have products or are marked featured.

**Attributes** (`attribute_defs`, editable): size, material, grade, schedule, pressure class, standard, end type, type. Any attribute marked *filterable* automatically appears as a storefront filter.

---

## 3. Database schema (Supabase PostgreSQL) — `supabase/migrations/`

| Migration | Contents |
|---|---|
| `0001_core_catalog.sql` | `profiles` (role: customer/staff/admin), `categories`, `brands`, `attribute_defs`, `products`, `product_images`, `product_documents` (datasheet/MTC), `product_attribute_values`, `product_variants`, `product_costs`, `variant_costs`, `product_relations`, `warehouses`, `stock_levels`, `stock_movements`, stock functions |
| `0002_commerce.sql` | `site_settings`, `addresses`, `orders`, `order_items`, `order_item_costs`, `order_status_history`, `payments`, `shipments`, `invoices`, `rfqs`, `rfq_items`, `rfq_events`, `rfq_attachments`, `internal_notes` |
| `0003_cms_analytics_import.sql` | `banners`, `homepage_sections`, `announcements`, `menu_links`, `analytics_events`, `import_batches`, `import_items`, `audit_log` |
| `0004_functions_rls.sql` | `place_order`, `admin_set_order_status`, `admin_record_payment`, `admin_issue_invoice`, `submit_rfq`, `get_rfq_by_token`, `admin_save_quotation`, `admin_convert_rfq`, `track_event`, dashboard RPCs, **all RLS policies**, storage buckets & policies |
| `seed.sql` | VAT 15%, company info from the catalogue, 10 categories + subcategories (EN/AR), attributes, homepage sections, menus, one default warehouse |

### Key design decisions
* **Family vs SKU.** A `products` row is a family. Sellable items are `product_variants` (unique SKU, size/grade/schedule/class, price). Stock is held per variant per warehouse. A family with no priced variant is quote-only.
* **Costs are not in customer-readable tables.** Row Level Security cannot hide a single column, so purchase cost lives in `product_costs`/`variant_costs`/`order_item_costs` (staff-only) and staff notes in `internal_notes`.
* **Prices are computed in the database** (`place_order`). The browser sends only variant ids and quantities.
* **Overselling protection** at three layers: `place_order` checks availability under a row lock, `stock_apply` re-checks, and the table constraint `reserved <= on_hand` makes it impossible to violate even through a bug.
* **Stock lifecycle:** order placed → *reserve*; shipped/ready/delivered/completed → *release + stock_out* (once, `stock_fulfilled`); cancelled/refunded → *release*. Every step is a row in `stock_movements`.
* **VAT** rate is read from `site_settings['public.vat_rate']` (default 15) and **snapshotted** on each order/quotation/invoice, so changing the rate never rewrites history.
* **Invoices are immutable** (trigger + no update policy). `zatca_*` columns exist and default to `not_integrated`; nothing in the system claims ZATCA compliance.
* **Roles:** `customer` (default for every sign-up, set by trigger), `staff`, `admin`. A trigger blocks self-promotion. Only an admin (or SQL editor/service role) can change roles.
* **Analytics are first-party and real:** `analytics_events` (page, product view, search, banner impression/click, add-to-cart, RFQ, WhatsApp). Visitors = distinct anonymous session ids; no IP address is stored.

Entity overview:

```
auth.users ─1:1─ profiles ─┬─< addresses
                           ├─< orders ─┬─< order_items ─1:1─ order_item_costs
                           │           ├─< payments, shipments, order_status_history
                           │           └─1:1─ invoices
                           └─< rfqs ─┬─< rfq_items, rfq_events, rfq_attachments
categories(tree) ─< products >─ brands          products ─┬─< product_images, product_documents
                                                          ├─< product_attribute_values >─ attribute_defs
                                                          ├─< product_variants ─< stock_levels >─ warehouses
                                                          │         └─< stock_movements (ledger)
                                                          └─< product_relations (related / alternative)
banners · homepage_sections · announcements · menu_links · site_settings
import_batches ─< import_items (staging, reviewed before publishing)
analytics_events · audit_log
```

---

## 4. Homepage design plan

Design language: red `#A6242E`, near-black `#0D0E16`, white, steel-grey gradient (sampled from the logo). Inter for Latin, Cairo for Arabic; full RTL mirroring via logical CSS (`ms-/me-/start-/end-`).

Sections (order, visibility and titles editable in **Admin → Content → Homepage sections**):
1. **Announcement bar** (admin-managed, scheduled).
2. **Header**: logo · search with live suggestions · language switch · account · cart (+ quotation list) · WhatsApp. Below it a **mega menu** (all 10 categories → subcategories with images).
3. **Hero carousel** — banners with placement `home_hero` (desktop + mobile images, schedule, order, link). If none are active, a branded default hero is shown.
4. **Category cards** with images.
5. **Featured products** · **Special offers** · **New arrivals** · **Best sellers** (computed from real orders).
6. **Brands** strip (from `brands.show_on_homepage`).
7. **Why KANZ CORNER** · **Bulk RFQ call-to-action**.
8. **Footer**: company info, editable link groups, contact, WhatsApp.

Product page: gallery · family description · variant selector (size/grade/schedule) · price or "Request a quote" · technical specs table · datasheet/MTC downloads · related & alternative products · WhatsApp inquiry · JSON-LD `Product`.

---

## 5. Admin portal architecture (`/admin`)

```
/admin                 Dashboard (revenue, daily/monthly sales chart, orders, pending RFQs, low stock, visitors, top viewed/sold, recent activity)
/admin/products        list · search · filters · bulk price update · import/export (CSV/XLSX) · duplicate-SKU check
/admin/products/[id]   tabs: General · Arabic · Pricing · Variants · Attributes · Images · Documents · Related · SEO
/admin/categories      tree editor, images, SEO, order
/admin/brands          logos, homepage flag
/admin/attributes      filterable attribute definitions
/admin/inventory       levels (all warehouses) · stock in/out/adjust · movements · valuation · low-stock · warehouses
/admin/banners         upload desktop/mobile, schedule, placement, order, impressions/clicks/CTR
/admin/rfqs            inbox → detail: line pricing, validity, lead time, PDF, status, convert to order, history
/admin/orders          list → detail: status, payments, shipments, invoice (VAT PDF), customer
/admin/customers       accounts, order history
/admin/import          load extraction → review (edit, compare image, approve/reject) → publish selected
/admin/content         homepage sections · announcements · menus · company info · SEO defaults · VAT rate
/admin/reports         sales by period, by product, stock valuation, banner performance (CSV export)
/admin/users           staff & role management (admin only)
```

**Security layers** (defence in depth)
1. `proxy.ts` redirects unauthenticated users away from `/admin/*` (optimistic check only).
2. Every admin layout/page/action calls `requireStaff()` / `requireAdmin()` which verifies the Supabase JWT (`getUser()`) and reads the role from `profiles`.
3. Row Level Security enforces the same rules in the database even if app code is wrong.
4. All inputs validated server-side with Zod; privileged operations are RPCs that re-check `is_staff()`.
5. The service-role key is used in exactly one server-only module (`lib/supabase/service.ts`), only for inviting staff, and never reaches the browser (no `NEXT_PUBLIC_` prefix).
6. Security headers set in `next.config.ts`.

---

## 6. Implementation phases

| # | Phase | Status marker |
|---|---|---|
| 1 | Project setup, DB schema, RLS, seed (tested on PostgreSQL 16) | `supabase/tests/rls_and_stock.sql` |
| 2 | Customer storefront | |
| 3 | Catalogue extraction & import review | `scripts/extract_catalogue.py` |
| 4 | Product & category management | |
| 5 | Inventory | |
| 6 | Banners | |
| 7 | RFQ, cart, orders, invoices | |
| 8 | Analytics & reporting | |
| 9 | Security testing & deployment | `docs/nextjs/03-SETUP-GUIDE.md` |

See `02-STATUS.md` for what has been built and verified at each step.
