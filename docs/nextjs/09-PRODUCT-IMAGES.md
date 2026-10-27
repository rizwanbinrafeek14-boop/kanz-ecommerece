# Product images: temporary images, placeholders, upload and replacement

Products never wait for photographs. A catalogue is imported first; each product then shows the best **temporary image** that
genuinely belongs to it, or a clearly labelled **placeholder**, until you upload your own photo — one at a time or in bulk.

## What a product shows, in order

| Situation | Shown on the website | Admin badge |
|---|---|---|
| You uploaded a photo | Your photo | **Photo** |
| The manufacturer's catalogue has a picture of the product | That picture, captioned *"Image from the manufacturer's catalogue"* | **Catalogue image** (temporary) |
| No picture, but the catalogue has the product's dimensional drawing | The drawing, captioned *"Drawing from the manufacturer's catalogue"* | **Catalogue image** (temporary) |
| Nothing | A light outline of the product type with the caption **"Photo coming soon"** (Arabic: "الصورة قريباً") | **Placeholder** |

Rules:

- **Temporary images come only from the same product's own catalogue pages.** The importer never takes a picture from another
  product, another manufacturer or the internet. A "reliable match" means the image was cropped from the page where that
  product is printed.
- **Downloading pictures from manufacturers' websites automatically is not done.** Exact model matches can't be verified, and
  the pictures are usually copyrighted. When a manufacturer sends you images, upload them like your own photos. Mark them as
  manufacturer images only if you have the right to use them.
- **Placeholders never look like a photograph.** They are a line drawing of the product *type*, always captioned "Photo
  coming soon". Screen readers hear "*product name* — photo not yet available".
- **The placeholder drawing is chosen automatically** from the product name, family type or category. The drawings are:
  flange, elbow / bend, tee, pipe, valve, gasket, stud bolt with nuts, grooved coupling.
  - Other fittings (caps, crosses, couplings, plugs, unions, reducers, inserts …) get the neutral drawing, never another
    fitting's shape.
  - So do washers and screws, products whose type is unclear, and products that only mention a pipe (clamps, supports,
    sleeves …).
  - You can override the drawing per product: *Images tab → "Placeholder while there is no image"*.

## Images are stored separately from the product

Images live in their own table (`product_images`) and in Storage (bucket `product-images`, folder = product id).

Uploading, replacing, restoring or deleting an image never touches the product: its texts, variants, prices, stock, brand,
family or materials stay as they are.

**Replacing an image** keeps the image record, so all of these stay in place:

- its position;
- the "main" star;
- the alt text;
- "shown for options".

References to the old file move to the new one: the social-sharing image and a family photo that used it. The previous file
is kept so you can **Restore previous image**. When you replace again, the file from two versions back is deleted, but only
if nothing else uses it (catalogue drawings can be shared with dimension tables and are never deleted while in use).

## Admin

- **Products → a product → Images tab.**
  - The *Product image* box shows the current main image (or the placeholder) and where it came from.
  - **Upload / Replace product image** — replaces the main image, or adds the first one.
  - **Restore previous image.**
  - The placeholder choice.
  - *All images* lists every image with its source badge, plus *Replace*, *Restore*, *Main*, *low-res*, alt texts and
    "shown for options".
- **Products list.**
  - Every row has an **Upload / Replace product image** button and an image badge (Photo / Catalogue image / Placeholder).
  - The *Image* filter lists products with no image, with a temporary catalogue image, or with a photo.
  - A banner counts the products still without your own photo.
- **Products → Product images** (bulk upload):
  1. **Drop files or choose files or a whole folder.** Up to 500 at a time.
  2. **File names are matched to products by:**
     - product SKU or variant SKU;
     - manufacturer code or reference;
     - the product's URL name (slug);
     - the exact product name.

     The comparison ignores upper/lower case and treats `-`, `_`, spaces and dots alike (`kz wn_150.JPG` = `KZ-WN-150`). A
     name without separators also works (`KZWN150.jpg`).
  3. **Several photos of one product:** add one suffix — `_2`, `-3`, `(4)`, `-front`, `-back`, `-side`, `-top`, `-detail`.
     The file named exactly after the code becomes the **main image**, the others **extra images**.
  4. **The table shows, for each file, how it matched** (e.g. *matched by variant SKU BTH-FU-SW-3000-1*) and the product's
     current image status.
     - Files that match several products ask you to choose one.
     - Files that match nothing get a product search box.
     - For each file you can choose *Replace / Set as main image*, *Add as extra image* or *Skip*.
     - A file matched by a variant SKU can be limited to that configuration ("Only for size 1, class 3000"). It is then shown
       when a customer selects that configuration, and is never the product's main image.
  5. **Upload.** You see the progress and the size saving. Each row reports *Stored* or the exact error.

## Optimisation (in the browser, before anything is stored)

- Accepted: JPG, PNG, WebP, AVIF, GIF and SVG, up to 40 MB (phone and camera originals).
- Photos are turned upright using the camera's orientation flag and scaled down to at most **2000 px** on the long side. They
  are never enlarged.
- They are stored as **WebP** (JPEG in the rare browser without a WebP encoder), plus a **600 px thumbnail**. The thumbnail is
  used on listings, search suggestions, the quote list and recently viewed.
- Measured in testing: a 4.1 MB 3000×2000 camera JPEG → 858 KB WebP (1333×2000, upright), plus a 10 KB thumbnail. That
  test photo is random noise, the worst case for compression; real product photos usually come out much smaller.
- Photos under 800 px are accepted but marked **low-res** so you know to replace them.
- SVG drawings are stored as they are.
- Catalogue crops made by the importer get the same treatment on the server: WebP, maximum 1200 px, plus a thumbnail when
  larger than 600 px.

## Where the image appears

Changes are live immediately: the pages are refreshed when you save. The main image (or its thumbnail) is used on:

- product listings, category and search pages, and family cards;
- the product page gallery (the main image first; images limited to an option appear when it is selected);
- header and homepage search suggestions;
- the quote list (cart), recently viewed, the datasheet PDF, social sharing, and Google structured data.

## Catalogue import

- `importApproved` (Catalogue import → Import approved) crops the product pictures the extraction marked. Their source is set
  to *catalogue*, with the page reference (e.g. "Bothwell fittings, page 3").
- When the extraction has no picture of a product, the product's own dimensional drawing becomes the temporary main image.
  The file is shared with the table and not copied.
- With neither, the product is imported anyway and shows the placeholder.
- The import message tells you how many products got a catalogue picture, a drawing or a placeholder.
- "No image" in the extraction review is information only. It never blocks an import.
- SQL packages (e.g. the gasket package) and other loaders write into `catalogue/…`. Those images are automatically classed
  as catalogue images (a database trigger), so they are never shown as your photos.

## Database (migration 0020, additive)

- `product_images` gains these columns:
  - `source` (upload / catalogue / manufacturer) and `kind` (photo / drawing);
  - `thumb_path`, `width`, `height`, `bytes`;
  - `original_name`, `source_note`;
  - `previous_path`, `previous_thumb_path`, `replaced_at`.
- Existing rows are classified: files in `catalogue/` or marked low-res count as catalogue images, and SVG files as drawings.
- `products` gains:
  - `placeholder_kind` (override);
  - `image_status` (photo / temporary / none, kept by a trigger), used for the filters.
- Functions:
  - `match_image_files(names[])` — staff only;
  - `replace_product_image(...)` and `restore_product_image(...)` — staff only, product folder enforced;
  - `unreferenced_image_paths(...)` — the safe-delete check;
  - `catalogue_import_images(...)`;
  - `search_suggestions` now returns thumbnails.
- Tests:
  - SQL test T36: matching rules, staff only, replace keeps the row and moves references, shared files are never deleted,
    and the folder is enforced;
  - browser suite `images.mjs`: 69 checks.
