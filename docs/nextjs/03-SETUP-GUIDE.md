# Setup guide — KANZ CORNER EST. online store

Written for a business owner, not a developer. Follow the steps in order. Budget about **1½ hours** the first time.
Everything below uses free web dashboards; no command line is needed except where marked *(optional, developer)*.

You will create three accounts: **GitHub** (you already have the code there), **Supabase** (database, logins, file storage) and **Vercel** (hosts the website).

---

## Step 1 — Create the Supabase project (the database)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**. Name: `kanz-corner`. Choose a strong **Database password** and save it in your password manager. Region: pick the closest to Saudi Arabia (e.g. *Frankfurt* or *Mumbai*; Supabase has no Saudi region).
3. Wait ~2 minutes until the project is ready.

## Step 2 — Create the database tables, security rules and starting data

1. In Supabase, open **SQL Editor** → **New query**.
2. On your computer open the file **`supabase/setup_all.sql`** from this repository (on GitHub click the file → **Raw** → select all → copy).
3. Paste into the SQL Editor and press **Run**. It should finish with “Success”. If you see an error, send me the message — do not run it twice.

This creates: all tables, the Row Level Security rules (customers can only ever see their own data), the stock/order/quotation logic, the 10 product categories with Arabic names, VAT at 15%, and your phone/email/address from the catalogue.

> What it does **not** create: products, prices, SKUs or stock. Those come from you (Step 7).

## Step 3 — Get the three keys

Supabase → **Project Settings → API**:

| You need | Where it is | Secret? |
|---|---|---|
| **Project URL** | “Project URL” | No |
| **anon / publishable key** | “Project API keys → anon public” | No (safe in the browser) |
| **service_role / secret key** | “service_role” (click Reveal) | **YES — never share, never put in a public place** |

## Step 4 — Configure sign-in (Supabase → Authentication)

1. **Providers → Email**: keep *Enable Email provider* ON. For a B2B shop, leave **Confirm email** ON (recommended).
2. **URL Configuration**:
   * **Site URL**: your final address, e.g. `https://www.kanzcorner.com` (until the domain is connected, use the Vercel address from Step 6).
   * **Redirect URLs**: add `https://www.kanzcorner.com/auth/callback` and `https://YOUR-VERCEL-ADDRESS.vercel.app/auth/callback`.
3. **Emails (SMTP)** — important: Supabase’s built-in email service is limited to a handful of emails per hour and is meant for testing. Before launch, add your own sender under **Project Settings → Authentication → SMTP Settings** (e.g. Zoho Mail, Google Workspace, SendGrid, Resend). Without this, customers may not receive confirmation emails.

## Step 5 — Put the website online with Vercel

1. Go to <https://vercel.com> → sign in with GitHub → **Add New… → Project** → import `kanz-ecommerece`.
2. **Root Directory**: click *Edit* and choose **`web`** (very important).
3. Framework is detected as Next.js. Open **Environment Variables** and add (names exactly as shown):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Step 3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key from Step 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Step 3 (Vercel keeps it private) |
   | `NEXT_PUBLIC_SITE_URL` | `https://www.kanzcorner.com` (or the vercel.app address for now) |

4. Press **Deploy**. After ~2 minutes you get a `*.vercel.app` address. Open it: you should see the KANZ CORNER homepage.
5. **Your own domain**: Vercel → Project → **Settings → Domains** → add `kanzcorner.com` and `www.kanzcorner.com`, then copy the DNS records Vercel shows into your domain registrar (Hostinger etc.). Update `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL (Step 4) afterwards and **Redeploy**.

> Never type the `service_role` key anywhere except Vercel’s Environment Variables box. It is not used by customer-facing pages.

## Step 6 — Create your administrator login

1. Open your website at `/en/account/register` and register with **your own email** (this creates a normal customer account).
2. Confirm the email if asked.
3. In Supabase → **SQL Editor** run this (replace the email):

   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@yourcompany.com');
   ```
4. Visit `https://YOUR-SITE/admin` and sign in. You now see the admin portal.

From then on, add colleagues from **Admin → Staff & roles → Invite staff** (staff can manage catalogue, stock, quotations and orders; only admins can change settings/VAT/roles and delete).

## Step 7 — Bring in the catalogue (review before anything goes live)

1. Admin → **Import review → Load catalogue extraction**. This stages **55 product families** extracted from your PDF plus **60 items from the earlier extraction that are not in this PDF** (copper pipes, forged fittings, instrument valves…). Allow about a minute for the images.
2. Open each item (or work in bulk): fix the names, specs and category, **replace the low-resolution picture with a high-resolution original**, then **Approve**.
   * Items marked **Third-party branding** (the gauge photo shows another company’s dial) must be opened and confirmed individually.
   * Items marked **Verify specs** contain catalogue details that look wrong (for example *A312 TP316* under carbon steel) — check them against your supplier documents.
   * Arabic names are **draft translations** — have a native speaker confirm them.
3. Select the approved items → **Create draft products**. They are created as *draft*, *quote-only* products: **no price, SKU or stock is invented**.
4. Go to **Products**, open each one, add real data when you have it (variants with SKUs, prices, datasheets, MTCs), then press **Publish**. Only published products appear on the website.

### Third batch: grooved fittings from the supplier certificates (MTC 26-1095)
**Import review** also shows **“Supplier mill test certificates — grooved fittings”**: 23 product families (elbows, tees, reducers, couplings, end caps, grooved flanges and flange adaptors) with the **sizes that appear on the certificates**.
1. Open that batch and **upload the certificate PDF** in the panel at the top. It is stored **privately** and attached to every product as an *MTC*, with the relevant page numbers in its title. (The PDF is deliberately **not** in the GitHub repository, which is public.)
2. Approve the items, then **Create draft products**. There are **no photos, prices, SKUs or stock**: add a real photo to each, and variants/SKUs/prices when you have them.
3. Check before publishing: the 300 psi value is printed as “working pressure” on some pages and “hydro test max. pressure” on others, so confirm the rating with the supplier; the manufacturer named on the certificates is not used as a brand on the site.

*If you set up your database before this feature existed, run this once in the SQL Editor:* `alter table import_batches add column if not exists shared_file_path text;`

### Prices and stock — when the product becomes “buyable”
A product is a **family** (e.g. “Carbon Steel Pipe — ERW”). To sell it online:
1. **Variants** tab → add a variant per sellable size/grade/schedule with a **real, unique SKU** and **price**.
2. **Pricing** tab → untick **Quote only**.
3. **Inventory** → **Stock in** the quantity you actually hold (with purchase cost).
4. **Publish**.

Anything without a price stays “Request a quote”.

## Step 8d — Catalogue import (manufacturer PDFs → products)
Run `supabase/migrations/0014_catalogue_extraction.sql` (contents, not the file name) and redeploy. Optional: add `ANTHROPIC_API_KEY` to the server environment to enable automatic extraction (about US$0.10–0.25 per page). Then follow `docs/nextjs/04-CATALOGUE-IMPORT.md`: upload the PDF, render pages, load the checked extraction file (or extract with Claude), review, approve, import as drafts, then publish. **Make the GitHub repository private first** (Settings → General → Danger Zone → Change visibility). Never commit catalogues or extraction files.

## Step 8e — Multi-brand product families
Run `supabase/migrations/0015_product_families.sql` and then `0016_family_listings.sql` (contents) and redeploy. Then follow `docs/nextjs/05-PRODUCT-FAMILIES.md`: approve the match suggestions in Admin → Product families, upload a family photo, and publish the family page.

## Step 8f — Materials and the Material filter
Run `supabase/migrations/0017_materials.sql` (contents) and redeploy. Then Admin → **Materials** → *Preview report* → *Run detection*, and work through "Needs verification" and "Material Not Verified" (approve, correct, or set materials in bulk). Run detection again whenever you load catalogue SQL packages; products imported from Admin → Catalogue import are classified automatically. Details: `docs/nextjs/06-MATERIALS.md`.

## Step 8g — Gaskets & sealing products
Run `supabase/migrations/0018_gaskets.sql` (contents) and redeploy. Then run the gasket package: `1-gaskets-products.sql` in the SQL Editor, upload its `catalogue` folder into Storage → `product-images`, run `2-gaskets-drawings.sql`. Review each product (yellow box on the product page in Admin), then Publish. Details: `docs/nextjs/07-GASKETS.md`.

## Step 8h — Better search and the new product page
Run `supabase/migrations/0019_search.sql` (contents) and redeploy. It builds the search index for all products; nothing in the products changes. Optional, for the spiral wound gasket page: run `3-gaskets-product-page-update.sql` from the gasket package, or fill Admin → product → Technical → "Product page overview and visual". Searches that find nothing appear in Admin → Reports.

## Step 8i — Product images (temporary images, placeholders, bulk upload)
Run `supabase/migrations/0020_product_images.sql` (contents) and redeploy. The migration only adds things and is safe to run again. Existing images are classified automatically: catalogue crops and drawings count as temporary catalogue images, and nothing is deleted. Afterwards:
- Admin → Products → Product images shows how many products still need a photo.
- Upload photos there in bulk, or per product with *Upload / Replace product image*.

See `docs/nextjs/09-PRODUCT-IMAGES.md`.

## Step 8j — Manufacturer website import (e.g. GALA)
Run `supabase/migrations/0021_web_catalogue.sql` (contents) and redeploy. It only adds things and is safe to run again. The import uses the same `ANTHROPIC_API_KEY` as PDF extraction; no new environment variable is needed. Then use Admin → Catalogue → **Import from a manufacturer website**. See `docs/nextjs/10-WEBSITE-IMPORT.md`. Leave image / document copying off unless you have the manufacturer's permission.

## Step 8c — New homepage
Run `supabase/migrations/0013_homepage_sections.sql` (contents, not the file name) and redeploy. The new homepage blocks appear in Admin → Content & settings → Homepage sections, where you can reorder or disable them. Blocks without real data (featured products, brands, certificates, material/standard chips) stay hidden automatically.

## Step 8b — SEO and Google (after the site is live on your domain)
Run `supabase/migrations/0012_seo.sql` (copy the file’s contents into the SQL Editor) and make sure `NEXT_PUBLIC_SITE_URL` is exactly `https://www.kanzcorner.com`. Then follow `docs/seo/README.md`: verify Search Console (paste the code in Admin → Content & settings), submit `sitemap.xml`, create your Google Business Profile (`docs/seo/GOOGLE-BUSINESS-PROFILE-CHECKLIST.md`), enter opening hours and the Arabic address, and fill the SEO tab of your priority products.

## Step 8a — WhatsApp, call and social links
Admin → **Social & contact**. Turn the contact button on, enter your WhatsApp number in international format (e.g. `+966 50 726 4938`), add your **real** social profile addresses (they must start with `https://`) and tick where each one should appear. Nothing is shown for a social network until you add it. Admin → **Certifications**: add only certifications the company really holds; attach them to products on the product’s **Certifications** tab.

**Quality & Certifications:** after running `0010`, also run `supabase/migrations/0011_quality_certifications.sql` once (copy the file’s contents, not its name). Then Admin → **Certifications** → add your real certificates (upload each issuer’s official logo and certificate PDF), publish them, and attach them to products on each product’s **Certifications** tab with status *Verified*. The public page is at `/quality`.

*If your database was created before this feature, run `supabase/migrations/0009_*.sql` (if you have not yet) and then `supabase/migrations/0010_social_contact_certs.sql` once in the SQL Editor, then redeploy.*

## Step 8 — Website content
Admin → **Content & settings**:
* **Company, VAT & SEO** (admin only): enter your **VAT registration number** and CR number (printed on quotations and invoices), confirm the VAT rate (15%), delivery/payment options. (WhatsApp now lives under **Social & contact**.)
* **Homepage sections**, **Announcements**, **Menus & footer links**.
* Admin → **Banners**: upload promotions (desktop + mobile image), choose placement, schedule, order. Impressions and clicks are counted automatically.
* Admin → **Categories / Brands / Attributes**: categories, category images, brand logos (only brands you are authorised to display), filters.

## Step 9 — Test everything before announcing (30 minutes)

Use a second browser/incognito window as a customer.

- [ ] Register a customer, confirm the email arrives, sign in.
- [ ] Search for a product; check the filters (size, grade…) and switch to Arabic (layout flips right-to-left).
- [ ] Add a priced product to the cart → checkout → the order appears in **Admin → Orders**; **Inventory** shows it as *reserved*.
- [ ] Ship the order → stock is deducted; record a payment; issue the VAT invoice and open the PDF.
- [ ] Send a bulk RFQ (several lines) as a guest → price it in **Admin → Quotations** → *Save & mark as quoted* → open the PDF → open the customer link → *Accept* → **Convert to order**.
- [ ] Upload a banner; confirm it shows on the homepage within a minute.
- [ ] Sign in as a customer and try `/admin` — you must be turned away.
- [ ] Dashboard figures match what you just did.

## Step 10 — Before real customers

| Item | Why |
|---|---|
| Real **SMTP** sender (Step 4) | Confirmation and password-reset emails |
| **VAT number & CR** entered | Printed on documents |
| Review **Privacy** and **Terms** pages (templates) with a lawyer | They are placeholders |
| Native-speaker **Arabic review** | Translations are drafts |
| **Supabase backups**: Project → Database → Backups (daily backups need a paid plan; consider “Point-in-time recovery”) | Disaster recovery |
| Turn on **MFA** for your Supabase, Vercel and GitHub accounts | Protects the whole shop |
| Replace low-resolution photos | Catalogue crops are 150–475 px |

---

## Payments (Saudi gateway architecture)
Checkout currently supports **bank transfer** and **cash on delivery**; staff record payments manually. Card / mada / Apple Pay / STC Pay are **intentionally disabled** until a gateway is connected. The database already has `payments` (method, gateway, gateway_reference) and order payment states. To connect a gateway (e.g. **Moyasar**, **HyperPay**, **Tap**, **PayTabs**, **Checkout.com** — all support mada) a developer needs to:
1. Create the merchant account and obtain keys (needs your CR, bank account, IBAN).
2. Add a server route that creates a payment session for an order and a **webhook** route that verifies the gateway’s signature and then calls `admin_record_payment`-style logic (use the service role only inside that verified webhook).
3. Enable the methods in `place_order` and the checkout form.
Never accept card details on your own pages; always use the gateway’s hosted fields/page.

## ZATCA e-invoicing (Fatoora)
The system issues **VAT invoices (PDF)** with seller/buyer VAT numbers and itemised VAT, numbered sequentially and **immutable once issued**. The `invoices` table has ZATCA-ready columns (`zatca_status`, `zatca_uuid`, `zatca_hash`, `zatca_qr`, `zatca_xml_path`), currently always `not_integrated`.
**The PDFs are not ZATCA-compliant e-invoices** (no QR code, XML, cryptographic stamp or clearance/reporting). Phase 2 e-invoicing requires onboarding with ZATCA, a CSID certificate and a certified integration. Do not describe the invoices as ZATCA-compliant until that is built and verified with your accountant.

## Email notifications
The application does not send quotation/order emails by itself. Staff see new RFQs and orders on the dashboard, and quotations are sent by copying the customer link/PDF into email or WhatsApp. Adding automatic emails (e.g. with Resend) is a straightforward future addition.

## Everyday troubleshooting
| Symptom | Fix |
|---|---|
| Homepage empty / no categories | `NEXT_PUBLIC_SUPABASE_*` variables missing or wrong in Vercel → fix → Redeploy |
| Can’t sign in to `/admin` | Account is still a customer: run the SQL in Step 6 |
| Confirmation emails never arrive | Configure SMTP (Step 4) |
| Image upload fails | File over 10 MB or not JPG/PNG/WebP (PDF for documents) |
| Social/WhatsApp icon rejected | Must be PNG, WebP or SVG, 512 KB or less, at least 16×16 px; SVGs with scripts or links are refused |
| “Item is not available / Insufficient stock” at checkout | Product unpublished, quote-only, or not enough available stock |
| Change not visible on the site | Wait up to 60 seconds, or hard-refresh; admin saves refresh the cache immediately |

## Running it on your own computer *(optional, developer)*
```bash
cd web
cp .env.example .env.local        # fill in the Supabase values
npm install
npm run dev                       # http://localhost:3000
npm run build && npm run lint     # checks used before deploying
```
Database changes live in `supabase/migrations/` (numbered). `supabase/tests/rls_and_stock.sql` contains behavioural tests for security, stock, orders and quotations that can be run against a scratch database.
