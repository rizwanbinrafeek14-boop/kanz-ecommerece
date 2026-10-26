# Gasket catalogue → products (repeatable import)

Converts the KanzCorner gasket catalogue (HTML, with its tables and embedded SVG drawings) into products, configurations, dimension
tables, drawings and materials, and writes a paste-ready SQL package. Keep the catalogue and the generated package **out of the repository**.

```
python3 -I scripts/gasket-import/build_gaskets.py KanzCorner_Gasket_Catalogue.html out/
```

Output in `out/`:
1. `1-gaskets-products.sql` — run in Supabase → SQL Editor (needs migrations up to `0018_gaskets.sql`). Creates the category
   *Gaskets & Sealing Products* (under *Gaskets & Gauges* when it exists) and 8 **draft**, quote-only products. Safe to run again:
   existing products are skipped, never overwritten; existing products with similar names are reported as "possible match" and recorded
   on the new product (Admin → product → yellow review box).
2. `catalogue/gaskets/*.svg` — the catalogue drawings as standalone SVG files (page styles inlined, ids prefixed so they never clash).
   Upload the `catalogue` folder into Storage → `product-images`.
3. `2-gaskets-drawings.sql` — links the drawings (product pictures, per-option drawings, table drawings). Run after the upload; safe to run again.
4. `gaskets.json` (everything that is loaded, for review) and `REVIEW.md` (missing / ambiguous data for the admin).

The script stops with an error when the catalogue layout changes (unexpected table headers, missing sections), instead of loading wrong data.
Only values printed in the catalogue are used: no prices, stock, brands or certifications are created, and "–" cells are not offered.
