# KANZ CORNER TRADING — Website

A custom **WordPress + WooCommerce** theme and launch kit for
[kanzcorner.com](https://kanzcorner.com), built for a Saudi industrial
supplier of pipes, fittings, valves, flanges, fasteners, gaskets, gauges
and related products.

## What's in this repo

```
theme/kanz-corner/          The WordPress theme — upload this to Hostinger
data/products-import.csv    90 products extracted from the catalogue PDF, ready for Products → Import
data/product-images/        One real photo per product, cropped from the catalogue PDF, filename = SKU
preview/                     Standalone HTML/CSS/JS mockups (no WordPress needed) used to design/QA the UI
docs/DEPLOYMENT-GUIDE.md    Step-by-step: Hostinger + plugins + WooCommerce setup + going live
docs/ADMIN-GUIDE.md         Day-to-day: adding products, handling quotes, approving B2B accounts, editing content
```

## Key features

- **Hybrid storefront**: priced products get instant Add to Cart; anything
  without a price automatically shows "Request Quote" instead.
- **Request-a-Quote system**: a floating quote list (like a wishlist),
  a quote request form, admin email notifications, and a Quote Requests
  dashboard in wp-admin.
- **B2B trade accounts**: business registration with CR/VAT capture and
  an admin approval workflow.
- **Bilingual, RTL-ready**: Arabic/English switch (via WPML or Polylang),
  full right-to-left layout mirroring, starter Arabic translations.
- **Freight Quote shipping method**: alongside standard Local Pickup, for
  bulk/heavy orders that need custom delivery pricing.
- **WhatsApp + live chat** floating widgets, newsletter capture.
- 90 products, each with a real photo cropped directly from the catalogue
  PDF (not stock images) — plus branded placeholder icons as a fallback
  for any product you add later without a photo yet.

## Start here

1. Read `docs/DEPLOYMENT-GUIDE.md` end to end before touching Hostinger.
2. Once live, `docs/ADMIN-GUIDE.md` is the day-to-day reference for
   whoever manages the site.
3. To preview the design without WordPress, open `preview/index.html`
   in a browser (it's fully static, no server required beyond opening
   the file, though a local server avoids any file:// path quirks).

## Known gaps / next steps

- **90 catalogue-derived product lines exist, each with a real photo,
  but no prices** — the catalogue PDF is a technical spec sheet, not a
  priced SKU list, so every product defaults to "Request Quote" until you
  set a real price. Everything else (pricing, stock, additional
  sizes/variants as separate SKUs) is designed for you to fill in through
  the normal WordPress admin — see `docs/ADMIN-GUIDE.md`.
- **Payment gateway, trade-tier pricing, and multilingual content
  translation** all require choices/accounts only you can set up
  (merchant account sign-up, pricing tiers, translator review) — see the
  relevant sections in `docs/DEPLOYMENT-GUIDE.md` and `docs/ADMIN-GUIDE.md`.
- This theme was built and reviewed without a live WordPress/MySQL
  environment available in the build sandbox (only static HTML/CSS/JS
  could be visually tested here). Run the testing checklist in
  `docs/DEPLOYMENT-GUIDE.md` §9 carefully on the real Hostinger install
  before announcing the site.
