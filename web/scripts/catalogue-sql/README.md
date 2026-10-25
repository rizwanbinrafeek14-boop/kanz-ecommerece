# Catalogue → SQL package

For loading a reviewed extraction file straight into Supabase when the admin import (Admin → Catalogue import) cannot be used.

1. `npx jiti scripts/catalogue-sql/payloads.ts extraction.json payloads.json <brand-slug>` (run from `web/`): validates the file (errors stop it) and builds the same SKUs, labels and descriptions as the admin import.
2. Render the PDF pages to `p-1.png`, `p-2.png`… at 300 dpi (e.g. `pdftoppm -r 300 -png catalogue.pdf p`).
3. `python3 scripts/catalogue-sql/make_sql.py payloads.json <brand-slug> "<Brand Name>" <pages-dir> <out-dir>` writes:
   * `1-<brand>-products.sql`: draft, quote-only products in one transaction. Existing slugs are skipped, never overwritten.
   * `catalogue/…webp` drawing crops, to upload to Storage → `product-images`, and
   * `2-<brand>-drawings.sql`, which links those drawings (run it after uploading the files).

Keep catalogues, extraction files and generated packages **out of the repository**.
