# Deployment Guide — KANZ CORNER TRADING website

This walks you (or whoever you hand this to) through taking the theme in
`/theme/kanz-corner` from this repo to a live site at `kanzcorner.com` on
Hostinger. Follow it top to bottom the first time; after that, only the
"Going live" section at the end matters.

---

## 0. What you're deploying

- A custom **WordPress + WooCommerce** theme called **Kanz Corner**
  (`/theme/kanz-corner`) — bilingual-ready (Arabic/English, RTL), with a
  hybrid "Buy Now / Request a Quote" storefront, B2B trade accounts, and a
  Request-a-Quote system.
- A **product import file** (`/data/products-import.csv`) with 40 product
  lines pulled from your catalogue PDF, organized into categories.
- Starter **Arabic translations** for the core UI (`/theme/kanz-corner/languages`).

This theme was built and code-reviewed in a sandbox without a live
WordPress/MySQL server available, so step 3 below (first real activation)
is the first time it runs against real WordPress — read the "Testing
checklist" at the end before announcing the site publicly, and don't
hesitate to flag anything that looks off.

---

## 1. Hostinger setup

You said you're on **Premium Web Hosting**. That's workable for
WooCommerce at this catalogue size, but it's an entry-level shared plan —
follow the performance notes in section 8, and if the catalogue grows
past a few hundred products or traffic grows a lot, plan to upgrade to
Business or Cloud hosting.

1. In **hPanel → Websites**, make sure `kanzcorner.com` is attached to
   your hosting plan and the domain's nameservers/DNS point to Hostinger.
2. **hPanel → Auto Installer (or Websites → Manage → WordPress)** → install
   WordPress if it isn't already. Use a strong admin password and a
   non-obvious admin username (not "admin").
3. **hPanel → SSL** → make sure SSL is issued and "Force HTTPS" is on.
4. **hPanel → Advanced → PHP Configuration** → set PHP to **8.1 or 8.2**,
   and raise `memory_limit` to at least `256M` if there's an option to.

---

## 2. Install required plugins

In `wp-admin → Plugins → Add New`, install and activate, in this order:

1. **WooCommerce** (required — the theme depends on it)
2. **WPML** *or* **Polylang** (for the Arabic/English switch — pick one,
   don't install both). WPML is paid but has the more polished WooCommerce
   integration ("WooCommerce Multilingual" add-on); Polylang is free and
   works fine for a simpler bilingual setup.
3. A **Saudi payment gateway** plugin — pick one:
   - **HyperPay** (official WooCommerce extension) — Mada, cards, Apple Pay, STC Pay
   - **Moyasar** — simpler setup, Mada + cards
   - **PayTabs** or **Tap Payments** — also common in KSA
   All of these require you to sign up for a merchant account with that
   provider first (KYC/business verification) — start that process early,
   it can take a few days.
4. A **live chat** plugin — **Tawk.to** (free) is the simplest.
5. An **SEO** plugin — **Yoast SEO** or **RankMath** (free tiers are fine
   to start).
6. **LiteSpeed Cache** (Hostinger runs LiteSpeed servers — this plugin is
   free and meaningfully speeds up the site on shared hosting).

The floating **WhatsApp button** is already built into the theme (no
plugin needed) — set your number in Customizer, see section 5.

---

## 3. Install the theme

1. Zip the contents of `/theme/kanz-corner` into `kanz-corner.zip`
   (zip the **folder itself**, so `kanz-corner.zip` contains
   `kanz-corner/style.css` etc., not the files loose at the top level).
2. `wp-admin → Appearance → Themes → Add New → Upload Theme` → upload the
   zip → **Activate**.
3. You'll see admin notices if WooCommerce or a multilingual plugin isn't
   active yet — that's expected until you finish steps 2 and 4.

---

## 4. WooCommerce setup wizard

Run through `WooCommerce → Settings`:

- **General**: Store address = your Al-Khobar address. Selling
  location = Saudi Arabia. Currency = **SAR**.
- **Tax**: enable taxes. Add a Saudi Arabia VAT rate of **15%**. Under
  **Tax → Prices entered with tax**, choose "Yes, I will enter prices
  inclusive of tax" — this matches the VAT-inclusive pricing you asked for.
- **Shipping**: create a shipping zone "Saudi Arabia" (or per-region zones
  if you want different pickup/delivery per city) and add **two** shipping
  methods to it:
  - **Local Pickup** (built into WooCommerce) — for warehouse pickup at
    Al-Khobar.
  - **Freight Quote (bulk/heavy items)** — a custom method this theme adds
    (`inc/woocommerce.php`). It charges $0 at checkout and just flags the
    order for your team to arrange freight separately — exactly the
    "Request Delivery Quote" flow you asked for. Orders placed with it get
    a "Freight quote needed" badge in `WooCommerce → Orders`.
- **Payments**: enable the gateway plugin(s) you installed in section 2
  and enter your merchant credentials, plus **Cash on Delivery** if you
  want it (built into WooCommerce, no plugin needed) and a **Direct bank
  transfer** method (also built-in) for invoice-based B2B orders.

---

## 5. Site identity, contact info & Customizer

`Appearance → Customize`:

- **Site Identity** → upload your real logo PNG here (you'll need to send
  it to whoever manages the site next, since it wasn't available as a
  file in the build environment — the theme currently shows a placeholder
  wordmark built from your brand colors). Also set a square version as
  the site icon/favicon.
- **Kanz Corner Settings** panel → fill in:
  - Phone, sales email, short/full address, WhatsApp number
  - Quote-request notification email (who gets emailed when a customer
    submits a quote)
  - Social links
  - Footer tagline

---

## 6. Create the required pages

WordPress needs these **pages to exist** (their slugs matter — the theme
auto-selects a custom template based on the slug, no manual template
assignment needed):

| Page title | Slug (URL) | Notes |
|---|---|---|
| Home | `/` | `Settings → Reading` → set as static front page |
| About Us | `about-us` | edit its content normally — see docs/ADMIN-GUIDE.md |
| Certifications & Brands | `certifications` | content template-driven, see ADMIN-GUIDE |
| Projects | `projects` | starts empty, see ADMIN-GUIDE |
| Contact | `contact` | includes the contact form automatically |
| Request a Quote | `request-a-quote` | includes the quote form automatically |
| Blog / News (optional) | any slug | `Settings → Reading` → set as "Posts page" |

WooCommerce creates its own **Shop**, **Cart**, **Checkout**, and
**My Account** pages automatically the first time you activate it — leave
those as WooCommerce created them.

`Settings → Reading`: set "Your homepage displays" → **A static page** →
Homepage = **Home**, Posts page = your Blog page.

---

## 7. Menus

`Appearance → Menus`, create three menus and assign them:

- **Primary Navigation** → Home, Products (link to Shop), About Us,
  Certifications & Brands, Projects, Blog, Contact
- **Footer — Products** → your top-level product categories
- **Footer — Company** → About Us, Certifications, Projects, Blog, Contact

If you skip this, the theme falls back to a sensible default menu built
from your product categories automatically — but a manually-built menu
gives you control over order and labels.

---

## 8. Import the products

1. Set up **product attributes/categories first is not required** — the
   CSV creates categories automatically from the `Categories` column
   (e.g. `Pipes > Carbon Steel Pipe`).
2. `Products → Import` → upload `/data/products-import.csv` → map columns
   (WooCommerce auto-detects them, since the header row uses its standard
   names) → Run the importer.
3. This creates **40 product lines** covering every category in your
   catalogue (Pipes, Fittings, Flanges, Valves, Fasteners, Gaskets,
   Gauges & Instruments, Other Products), each with:
   - A description built from the catalogue's spec tables (sizes,
     schedules, grades, standards, brands)
   - **No price** — they'll show "Request Quote" automatically until you
     set a real price (see ADMIN-GUIDE.md → "Pricing a product")
   - A branded placeholder icon (no real product photos exist yet — see
     ADMIN-GUIDE.md → "Adding real product photos")
4. Everything beyond these 40 lines — individual sizes/variants as
   separate SKUs, real prices, real photos, stock quantities — is yours
   to add, as discussed. ADMIN-GUIDE.md walks through exactly how.

---

## 9. Testing checklist before announcing the site

Go through this on the live domain before sharing it publicly:

- [ ] Homepage loads, hero/categories/featured products all show
- [ ] Switch language (AR/EN) — layout mirrors correctly in Arabic
- [ ] Browse a category, open a product — spec table displays
- [ ] Click "Request Quote" on a product → drawer opens → submit the quote
      form → you receive the notification email
- [ ] Set a real price on one test product → confirm it shows "Add to
      Cart" instead of "Request Quote", and the full cart → checkout →
      payment flow works (use your gateway's sandbox/test mode first)
- [ ] Register a **Business** account → confirm you get the admin
      notification email → approve it in `Users` → confirm the customer
      gets the approval email
- [ ] Place a test order using the **Freight Quote** shipping method →
      confirm it's flagged in `WooCommerce → Orders`
- [ ] Test on an actual phone, not just a resized browser window
- [ ] Run the homepage through Google's PageSpeed Insights and Mobile-
      Friendly Test

---

## 10. Performance & security notes (shared hosting)

- Turn on **LiteSpeed Cache** page caching once the site is fully
  configured (caching while you're still actively changing settings can
  hide your own changes behind stale cache).
- Compress product/category images before upload — WebP where possible.
- Keep plugin count lean; every extra plugin costs load time on a shared
  plan. The plugin list in section 2 is the minimum needed for the
  features you asked for.
- Turn on Hostinger's **automatic backups** (hPanel → Backups) and keep
  WordPress core / plugins / theme updated.
- Limit login attempts (a security plugin, or Hostinger's built-in
  "Hostinger Security" if available on your plan) — WooCommerce stores
  handle payment-adjacent data and are a common brute-force target.

---

## 11. Going live

1. Finish sections 1–9 on a temporary URL or with the site set to
   "Search engines discouraged" (`Settings → Reading`).
2. Once the testing checklist passes, turn search-engine visibility back
   on, submit your sitemap (from your SEO plugin) to Google Search
   Console, and set up a Google Business Profile with your Al-Khobar
   address for local search.
3. Announce it.

If anything in this guide doesn't match what you see in wp-admin (plugin
UIs change over time), the underlying goal in each step is what matters —
adjust for whatever the current plugin version shows you.
