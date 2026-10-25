# Product families: one page per product type, with a manufacturer selector

## How it is organised
Product family (e.g. "Forged 90° Elbow") → manufacturer offerings (one product per brand: Bothwell, Mega, JD Delcorte…) → configurations (size / connection / class…) → dimension tables, drawings and documents.

Every brand keeps its own data. The family page only *chooses* which brand's data to show; nothing is copied or mixed.

## Setting up
Run `supabase/migrations/0015_product_families.sql` (contents) in the SQL Editor, then redeploy. Existing products and addresses keep working; nothing joins a family page until you confirm it.

## Admin → Product families
* **Match suggestions.** Products that the catalogue import (or the SQL packages) placed in the same family appear here with a confidence level:
  * *Exact*: same choices (e.g. connection / class / size), a common product standard (ASME B16.11 = ANSI B16.11), and shared connection types.
  * *Likely*: some of these agree. Check before approving.
  * *Uncertain*: they don't agree, or the names carry different qualifiers (e.g. "Female-Female"). Check carefully.

  **Approve** adds the offering to the family page. **Keep separate** leaves it as its own product page. Nothing is linked automatically.
* **Family page.** Set the name (EN/AR), address, category, your own photo (until you upload one, the page shows the selected brand's drawing), short/long description and SEO. **Publish family page** becomes available once at least one offering is confirmed *and* published.
* **Offerings.** Confirm, remove from the page, reconsider, reorder (the first is selected by default), unlink, or add any existing product. Sizes, tables, drawings and documents are still edited per product (Products → product). Untick *active* on a configuration to hide it.

## What customers see
* `/en/product/<family>`: brand selector, then material / size / connection / class pickers (only that brand's real combinations), the selected-configuration summary (SKU, manufacturer code, weight), Request a quote / Add to quote, then tabs for specifications, drawings (zoom and download), dimension tables (selected row highlighted) and downloads (datasheet, sign-in required). Below the tabs: **Compare brands** (up to 3).
* **Switching brands** keeps every choice the new brand also offers. Anything it doesn't offer is changed, with a note ("Mega does not list the same choice: Size 1/8" → 1/4"").
* **Links and redirects.** `?brand=mega` selects a brand (useful for sharing links). A confirmed brand's own page permanently redirects to the family page with that brand selected. Unpublishing the family, or removing the offering, restores the brand page.
* **Search engines.**
  * One indexed page per family (canonical without `?brand=`), with ProductGroup structured data listing each brand offering (brand, manufacturer part number, standard).
  * Redirected brand pages are left out of the sitemap.
  * Prices, ratings and stock are never invented.
