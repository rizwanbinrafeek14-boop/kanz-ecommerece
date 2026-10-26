# Materials: classification, filters and selectors

## Where materials are stored
| Table / column | What it holds |
|---|---|
| `material_types` | The material list: CS, SS, AS, DSS, SDSS, NI, GI, CI, BRASS, BRONZE, CU, AL, HDPE, PVC, CPVC, PPR, OTHER, plus custom types you add (Admin → Materials). |
| `product_materials` | One row per manufacturer offering and material: exact grades, status, where it was found (`source`), note (e.g. "Galvanized coating on carbon steel"), and whether an admin decided it. |
| `product_variants.material_code` | Optional. Set it only when an offering's variants come in different materials. A variant without its own material carries all of the offering's shown materials. |

Status: **verified** (admin) and **auto** (high-confidence rule) are shown in the shop. **unverified** stays hidden until you approve it. **rejected** is kept so detection does not add it again.

Older data stays where it was (`material` / `grade` attributes, `specs.materials` catalogue lists); detection reads it, nothing is deleted.

## Automatic detection rules
Shown straight away (auto):
- an ASTM / UNS grade that maps to one material, found in the product's own data: variant grade, grade attribute, or a catalogue grade list that is specific to the product (e.g. Thai Benkan production range). Examples: A105, A234 WPB/WPC, A350 LF1/LF2, A420 WPL6, A860 WPHY → CS; A182 F304/F316(L), A403 WP304/WP316, S31254 → SS; F51/F60, S31803/S32205 → DSS; F53/F55, S32750/S32760 → SDSS; A182 F5/F9/F11/F22/F91, A234 WP1…WP91, A350 LF3 → AS; B366/B564 → NI;
- a material written explicitly in the product name or the material attribute ("Stainless Steel", "Brass", "HDPE" …).

Stored for review (unverified, hidden): catalogue lists printed "in general" / "non exhaustive", headings without a grade, and keywords or grades mentioned only in a description.

Never: dimension standards (ASME B16.11, ANSI B16.5, MSS SP-97 …) are not grades; galvanizing is a coating (recorded as GI with the base steel in the note), never "zinc"; nothing an admin verified, rejected or edited is changed.

Report (Preview / Run detection): classified, multiple materials, needs verification (incl. Material Not Verified), missing grades, possibly incorrect (the name says one material, the grades another).

## Admin
- **Admin → Materials**: detection + report, filters (missing material, needs verification, auto-detected, verified, missing grades, by material, search), bulk *Approve detected* and *Set material + grades* for selected products, custom material types.
- **Product → Materials tab**: each material with status, grades and detection source; approve / save grades / reject; add a material; per-variant material.

## Shop
- Filters: Material, Brand, Size, Connection, Pressure class (+ other filterable attributes) on /products, categories, search and `/brand/<slug>`. Multi-select within a group, combined across groups. A product or family appears only if **one** active variant satisfies all selected material / size / connection / class conditions together (brand is per offering). Counts are listing entries, so a family counts once.
- Cards show `Materials: CS | SS` (union of the family's brands); the active material filter is highlighted and the card link opens the product with `?material=`.
- Family page: Material first (brands that do not list it are disabled), then brand, then the brand's grades, then size / class / connection. Product page: Material and Grade above the options. The choice goes into the quote / cart line ("Carbon Steel (CS) · Grade A105").
- Filtered listing URLs are `nofollow` and canonicalised to the unfiltered page (existing listing SEO rules); brand pages are in the sitemap.
