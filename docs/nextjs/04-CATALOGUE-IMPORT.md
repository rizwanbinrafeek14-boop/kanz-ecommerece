# Catalogue import (Admin → Catalogue import)

A reusable workflow for turning a manufacturer's PDF catalogue into products with variants, dimension tables and drawings. Nothing becomes public until a person has reviewed it, imported it and pressed **Publish**.

## 1. Before you start (once)
1. Run `supabase/migrations/0014_catalogue_extraction.sql` in the Supabase SQL Editor (paste the file's contents). It adds product families, options, dimension tables, the private `catalogue-sources` storage bucket and the extraction workspace, all staff-only.
2. Optional: add `ANTHROPIC_API_KEY` to the server environment (Hostinger → Node.js app → Environment variables) and redeploy. Without it you can still load checked extraction files.
3. Keep the GitHub repository **private** (see section 6). Manufacturer catalogues and extraction files must never be committed.

## 2. The workflow
1. **Upload** the PDF (up to 50 MB) and choose the manufacturer, or type a new one. A new brand is created *inactive*. The PDF is stored privately and never shown on the site.
2. **Render pages.** Your browser renders each page to an image, scanned pages included. It takes a few seconds per page.
3. **Extract**, in one of two ways:
   * **Extract with Claude** (needs the API key): each rendered page is read by Claude (vision + any text layer). The cost so far is shown live. Pages Claude is unsure about are marked *Needs review*.
   * **Load extraction file**: a checked `kanz-catalogue-extraction/1` JSON file, such as the ones prepared for your catalogues. The file must have the same page count as the PDF.
4. **Review** each product: the source page is shown beside the data. Fix options, variants, dimension rows, standards, materials and drawing crops (drag on the page). The **Checks** panel lists errors, which block approval, plus warnings and notes.
5. **Approve** the products you have checked, then **Import approved**. Each becomes an **unpublished, quote-only draft** with variants, a dependent size/class/connection selector, a Dimensions tab and drawings credited "Source: [manufacturer] catalogue". The import is all-or-nothing per product.
6. Open the product in **Products**, add prices/stock and photos when you have them, and **Publish**. Activate the brand under **Brands** if you want it listed.

## 3. Rules the system enforces
* Every value carries its source page, and nothing is invented: no "generate all combinations" button exists. Only size/class/connection combinations that appear in the catalogue become variants.
* One product per manufacturer per product type. Different manufacturers are never merged; they share a **product family** instead (e.g. the 90° elbows of Bothwell and Benken).
* Duplicate detection flags a record when the same brand already has that family or a product with the same name. **Existing products are never overwritten**: importing always creates a new draft.
* Standards are marked *product* (printed for that item) or *general* (company approvals, references). General approvals are not shown as product certifications.
* Materials and grades are only those the catalogue lists explicitly.
* Manufacturer photos are not used as product photos; only dimension drawings are cropped, and only from catalogues you are allowed to use.

## 3b. Images: import first, photos later
Missing photos never hold up an import. Each imported product shows the best temporary image that belongs to it:
1. its picture cropped from its own catalogue page;
2. otherwise its dimensional drawing;
3. otherwise a placeholder captioned "Photo coming soon".

The website credits catalogue images ("Image from the manufacturer's catalogue"). Upload your own photos later, per product or in bulk by SKU / code / file name: see `09-PRODUCT-IMAGES.md`.

## 4. Claude extraction cost
Claude Opus 5.5 is priced at US$4 per million input tokens and US$20 per million output tokens. One rendered page is about 1,600 image tokens plus the instructions. A dense dimension-table page produces several thousand output tokens. Expect **about US$0.10–0.25 per page**, i.e. US$10–25 for a 100-page catalogue. The admin shows the running cost and lets you stop after the current page. Re-extracting a page costs again, so review rather than re-run.

## 4b. Datasheets
Customers must be signed in to download datasheets (generated or uploaded). Visitors are asked to sign in or create a free account and are brought back to the product.

## 5. Export
JSON (re-loadable), CSV and Excel (variants, dimensions and page status) for every catalogue, for checking in a spreadsheet or archiving.

## 6. Make the GitHub repository private
GitHub → the repository → **Settings** → **General** → scroll to **Danger Zone** → **Change visibility** → **Make private** → confirm. Hostinger's Git deployment keeps working as long as the connected GitHub account still has access; if a deploy fails afterwards, re-authorise GitHub in Hostinger's Git settings.

## 7. Extraction file format (`kanz-catalogue-extraction/1`)
`{ format, manufacturer, source_title, page_count, pages:[{page,status,note,method}], products:[…] }`. Each product has `family`, `name_en/ar`, `category_slug`, `standards`, `materials`, `options` (e.g. connection / class / size with labels), `variants` (option values + weight + page), `dimension_tables` (columns with symbol and unit, `applies`, rows matched to variants, verbatim footnotes, drawing crop), `images` (page + crop box), `notes`, `warnings` and `pages`. The exact schema is in `web/src/lib/catalogue/schema.ts`.
