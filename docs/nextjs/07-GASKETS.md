# Gaskets & sealing products

Source: *Gaskets & Sealing Products — Technical Catalogue* (Kanz Corner Trading, HTML). Import tool: `web/scripts/gasket-import/` (see its README).

## Products (one card each)
| Product page | Choices on the page | Dimension data |
|---|---|---|
| Spiral Wound Gaskets – ASME B16.20 | style (SW-CR, SW-IR/CR, SW, SW-IR) → flange standard → NPS → class; winding metal, filler, inner / outer ring material | B16.5, B16.47 Series A, B16.47 Series B (d1–d4, per style) |
| Non-Metallic Gaskets – flat ring & full face (ASME B16.21), sheet & custom cut | form → standard → NPS → class; sheet material, thickness 0.8–6 mm | ring B16.5 / B16.47 A / B16.47 B, full face B16.5 Class 150 |
| Flange Insulation Kits – Type E, F & D | kit type; gasket, sealing element, sleeve/washer material, flange, bolts, ring number (D) | — |
| Expanded PTFE Joint Sealant | width, application | — |
| Heat Exchanger & Metal Jacketed Gaskets | 11 types → standard → NPS → class (double jacketed) or made to drawing | double jacketed B16.5 / B16.47 A / B16.47 B |
| Camprofile (Kammprofile) Gaskets – ASME B16.20 | style → standard → NPS → class; core, facing | B16.5 (W, d1–d3), MSS SP-44 / B16.47 A |
| Ring Type Joint Gaskets – R, RX & BX | type → flange standard → class → NPS → ring number; material & hardness | R oval, R octagonal, RX, BX |
| Graphite Packing Rings | form; section, density, grade, dimensions | operating limits |

The non-metallic sheet page and the B16.21 ring / full-face pages of the catalogue are one product (the cut gaskets are made from those sheets).
Ordering information, the marking example, unit-conversion and Class↔PN charts are supporting content, not products.

## How it works on the site
* **Configurations** are the catalogue's real combinations only (e.g. no SW-CR where an inner ring is mandatory, no Class 2500 above NPS 12, no oval R93+).
  "Not applicable" values (`na`) hide their selector (e.g. RX rings are chosen by ring number only).
* **Configuration choices** (`products.specs.choices`) are asked on the page and written into the quote / WhatsApp enquiry with the quantity;
  required ones must be filled before the enquiry. A choice or value can depend on the configuration (PTFE filler only with an inner ring).
* **Materials** are stored per component (`product_materials.components`: winding, filler, inner ring, outer ring, core, facing …), so a gasket
  with stainless windings and a carbon-steel outer ring is found under both materials. Import rows (`origin = 'import'`) are never changed by
  the automatic material detection.
* **Drawings** follow the selection (`product_images.option_match`, and each dimension table has its own drawing). Products without a drawing
  in the catalogue (ePTFE sealant, packing rings) show the standard placeholder until a photo is uploaded.
* **Filters**: gasket family, material, size, pressure class, flange standard / series (matched on the same configuration as size and class),
  gasket standard, brand (none yet). One card per product; counts are listing entries.
* **No manufacturer** is named in the catalogue; products have no brand and the page says the manufacturer is confirmed in the quotation.
  Each product has a draft product family, so a manufacturer added later can join it (Admin → Product families) with its own data.
* Standards are shown as information only; certification badges appear only for verified certificates (Admin → Certifications).

## Admin
Product → **Technical** tab: configuration choices (JSON), specification rows, standards, notes, and every dimension table as tab-separated
rows (copy to / from a spreadsheet). **Images** tab: "Shown for options" per drawing. **Materials** tab: materials with the parts they are used for.
A yellow box lists the import's review notes and any possible existing match.
