# Importing a manufacturer's website catalogue (e.g. GALA Valves)

**Where:** Admin → Catalogue → **Import from a manufacturer website**. Each website you add becomes a *catalogue source*, like an
uploaded PDF. It goes through the same review → approve → import steps, and nothing is published by itself.

## The workflow

1. **Create the source.** Fill in:
   - the start page (a product listing, e.g. `https://www.gala-valves.com/products/index_2.html`);
   - the manufacturer;
   - the scope — only pages under this path are followed (default: the folder of the start page; use `/` for the whole site);
   - the page limit and the seconds between requests;
   - **image / document reuse**, which is off by default. Tick it only if the manufacturer or your distribution agreement
     allows copying, and note where that permission comes from (the note is stored with the source).
2. **Crawl.**
   - The importer reads `robots.txt` first and identifies itself as `KanzCornerCatalogueImport/1.0`.
   - It waits at least 2 s between requests, or the site's `Crawl-delay` if that is longer, and follows pagination and product
     links inside the scope.
   - Every URL lands in the **URL manifest** with its type, status, HTTP result and error, so you can see that every page was
     processed.
   - The crawl runs in short steps from your browser. Pause and resume at any time; it continues where it stopped, even after
     closing the page.
   - It stops by itself — and never works around it — when the site answers 401 / 403 / 429 or when `robots.txt` cannot be
     read.
   - Redirects are recorded and their target is queued. Links that leave the manufacturer's site are not followed.
3. **Extract** (needs `ANTHROPIC_API_KEY`).
   - Each fetched page is read by Claude: listing pages are recorded as listings, and product pages become review records.
   - The rules are strict:
     - only values printed on the page are taken, verbatim (units, model numbers, wording);
     - sizes become selectable variants only when the page lists them individually;
     - pressure ratings or connections are combined with sizes only when the page says which go together — otherwise they
       are kept as specification rows ("Size range: DN50 – DN600", "Pressure rating: PN10/16");
     - approvals (UL, FM, WRAS …) are kept as published specification rows, never turned into certificates;
     - image and document links must appear on that page; anything else is removed and flagged.
   - Missing or unclear values get a "needs verification" warning.
   - Without a key you can load an extraction file instead (same format as the JSON export).
4. **Review.** Each record shows:
   - the source link and the date it was read;
   - the specification rows, the image and document links, and the warnings.

   Fix values against the source page, then **Approve**.
5. **Import approved.** Products are created as **unpublished, quote-only drafts**, marked **"Catalogue item — request a
   quotation"**:
   - no prices, stock or delivery dates are ever set;
   - images are copied (WebP + thumbnail, credited "Manufacturer's image") only when reuse is permitted. Otherwise they stay as
     review links and the product shows the labelled placeholder until you upload your own photo;
   - documents are copied (PDF only) when permitted; otherwise the product links to the manufacturer's own file (https only);
   - the source page and date are kept on the product and cited in its description;
   - materials are classified automatically, as for PDF imports.
6. **Publish** the drafts you want from Admin → Products when you are ready.

## Duplicates, re-runs and updates

- Every imported product remembers its source: page URL + model, stored per manufacturer. A database rule makes a second
  product with the same source impossible, so re-running a crawl or an import never creates duplicates.
- A record whose source was imported before is shown as **"update: n change(s)"** or **"already imported, no changes"**.
  - **Review updates** shows each field side by side: now vs. from the manufacturer.
  - Only these fields can be updated: descriptions, model number, specification rows, standards, materials, and new
    documents.
  - Names, prices, stock, variants, images and the publication status are never changed by an update.
  - Every applied update is written to the audit log with its changes.
- The same manufacturer + model / name found elsewhere (e.g. from a PDF catalogue) is flagged as a possible duplicate.
  Products of other manufacturers in the same family are linked, never merged.

## Retry, resume, export

- **Retry failed pages** queues failed, blocked and limit-skipped pages again and re-reads `robots.txt`.
- **Retry failed extractions** re-reads pages whose extraction failed.
- **Export:**
  - the URL manifest as CSV (every URL with status, HTTP code, error — the error report);
  - Excel: one row per variant with model, source URL, specifications, document and image links, plus the "Website pages"
    and "Problems" sheets;
  - JSON: everything, and it can be loaded again.

## Safety

- The importer is staff only:
  - the server actions check the session;
  - the manifest table is protected by row-level security;
  - exports refuse requests without a staff session.
- **Network:**
  - only public internet addresses are fetched — private, loopback and link-local addresses are refused;
  - every redirect hop is checked;
  - sizes are capped (HTML 5 MB, images 15 MB, PDFs 25 MB) and content types are checked;
  - no cookies or logins are used.
- **Content:**
  - page text is cleaned (scripts, styles and forms removed) before extraction;
  - downloaded images are re-encoded;
  - PDFs are checked for the `%PDF` signature;
  - customers reach linked documents through the existing signed-in datasheet route, which redirects to the manufacturer's
    https file.

## Setup

- Run `supabase/migrations/0021_web_catalogue.sql`. It only adds things and is safe to run again.
- Make sure `ANTHROPIC_API_KEY` is set in Vercel (it is already used for PDF extraction). No other new environment variable is
  needed. `CATALOGUE_CRAWL_ALLOW_PRIVATE` exists only for automated tests and must never be set in production.

## Status of the GALA import

The GALA website could not be reached from the development environment (network policy: proxy refused `www.gala-valves.com`),
so **no GALA product has been discovered, extracted or imported yet**.

You can run the import yourself from the admin once it is deployed, or allow `www.gala-valves.com` in the development
environment's network settings and ask for the import to be run here.

Before copying GALA images or datasheets, confirm reuse permission with GALA (or your distribution agreement). Without it,
the products are imported with data, links and placeholders.

## Tested (locally, against a fictional test site)

- **The test site** has:
  - 3 paginated listing pages and 5 product pages;
  - a robots.txt with a disallowed folder and `Crawl-delay`;
  - a 404, a 500, a redirect inside the site and a redirect off the site;
  - tracking parameters, and out-of-scope and off-site links;
  - images, and https datasheet links on another host.
- **A stand-in for the Claude API** runs the real extraction path. It deliberately returns one image URL that is not on the
  page, to check that it is rejected.
- **The suite (`webimport.mjs`)** checks:
  - crawl coverage and polite timing;
  - extraction and the link allow-list;
  - review, approve and import, with and without image permission;
  - linked datasheets; no prices or stock;
  - re-run idempotency, and update preview + apply;
  - the exports, and refusal without a staff session;
  - the storefront label, specifications, credited image, datasheet redirect after sign-in, search by model and
    manufacturer, and adding to the quote list;
  - mobile layout and axe.
- **SQL test T37:** the manifest is staff only, a source key can be used only once per manufacturer, external links must be
  https, and a website source needs a URL.
