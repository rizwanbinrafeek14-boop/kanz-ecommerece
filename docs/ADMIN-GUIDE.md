# Admin Guide — running the KANZ CORNER TRADING website

Day-to-day tasks for whoever manages the site in `wp-admin`. Assumes the
one-time setup in `DEPLOYMENT-GUIDE.md` is already done.

---

## Adding a new product

`Products → Add New`:

1. **Title** — the product name.
2. **Description** — full details; shows on the product page.
3. **Short description** — the box on the right side of the product page.
4. **Product data → General** — set a **Regular price** if you want this
   item to sell instantly online. **Leave it blank** if you want it to
   show "Request Quote" instead (see next section).
5. **Product data → Inventory** — SKU, stock quantity if you're tracking it.
6. **Product image / Gallery** — upload real photos here. Until you do,
   the product shows a branded placeholder icon matching its category
   automatically — nothing looks broken, it just won't have a real photo.
7. **Product categories** (right sidebar) — assign it to a category (e.g.
   Pipes → Carbon Steel Pipe). Create new categories/sub-categories here
   any time.
8. **Specification Table** (box below the description editor) — add
   rows like `Size Range` / `1/2" – 24"`, `Standard` / `ASTM A105`,
   `Brands Available` / `ULMA, MGI, China`. These render as the neat spec
   table on the product page. Add or remove rows freely — different
   product types need different rows (a valve might need "Class" and
   "Connection Type" where a pipe needs "Schedule").
9. **Pricing Mode** (box in the right sidebar) — tick "Hide Add to Cart —
   show Request Quote" to force quote-only regardless of price, or leave
   it unticked once you're ready for a product to sell directly.
10. Publish.

### Pricing a product (switching Request Quote → Add to Cart)

Just enter a **Regular price** in Product Data → General, and make sure
the "Pricing Mode" checkbox (hide Add to Cart) is **unticked**. The
product page and shop grid switch to a normal Add to Cart button
automatically — no other setting to change.

### Adding real product photos

Any time you have real photos, open the product, add them to **Product
image** (main photo) and **Product gallery** (additional angles), and
Update. The branded placeholder icon is only a fallback for products
with no photo yet.

### Bulk-editing many products

`Products` list → select several → **Bulk actions → Edit** lets you
change category, price, and stock status for many products at once.
For large catalogue updates, re-use `Products → Import` with an updated
CSV (it can update existing products if you include their SKU).

---

## Handling quote requests

`Quote Requests` in the left admin menu (below Products):

- Each row is one submission: contact info, items requested, project
  message.
- Open one to see full details, including exactly which products (if
  any) the customer attached from the site.
- Change its **Status** (top-right box) as you work it: New → Quoted →
  Won/Lost. This is just for your own tracking — it doesn't email the
  customer automatically. Reply to them directly (their email is right
  there, or call/WhatsApp using the phone number they gave).
- You also get an **email** the moment a request comes in (sent to the
  address set in Customizer → Kanz Corner Settings → "Quote requests
  notification email") — you don't have to check the dashboard proactively.

---

## Approving business (B2B) accounts

When someone registers as a "Business / Trade account":

1. You get an email with their company name, contact, and CR number.
2. `Users` → find them → the **Account Type** column shows "Pending
   review".
3. Open their profile → scroll to **Kanz Corner — Business Account** →
   change **Approval status** to Approved (or Rejected) → Update User.
4. Approving sends them an automatic email. Trade-specific pricing isn't
   wired up yet (see "Trade pricing" below) — approval today just marks
   them as a vetted business customer.

### Trade pricing (tiered pricing for approved businesses)

This build handles the **account/identity** side of B2B (registration
fields, CR/VAT capture, admin approval) but doesn't include a specific
tiered-pricing engine, since you hadn't defined your trade discount
structure yet. When you're ready, the cleanest path is a dedicated
plugin — **Wholesale Suite** or **B2BKing** are the common choices — which
can read the `kc_account_type` / `kc_b2b_status` user-meta this theme
already sets to decide who gets trade pricing.

---

## Orders needing a freight quote

`WooCommerce → Orders` — any order placed with the "Request Delivery
Quote" shipping method shows an orange **"Freight quote needed"** badge
on its order screen. Follow up with the customer to arrange and price
delivery, then update the order status as normal once resolved.

---

## Editing site-wide info (phone, WhatsApp, address, social links)

`Appearance → Customize → Kanz Corner Settings`. Changes apply
site-wide immediately (header bar, footer, WhatsApp button, contact page).

---

## Editing page content

- **About Us** (`/about-us/`) — fully editable through the normal page
  editor (`Pages → About Us → Edit`). What you type there replaces the
  starter paragraphs pulled from your catalogue.
- **Certifications & Brands** (`/certifications/`) and **Projects**
  (`/projects/`) — these pages use a custom layout (brand badges,
  standards grid, project cards) rather than the plain text editor, so
  their content lives in the theme files themselves
  (`page-certifications.php`, `page-projects.php`) rather than the normal
  editor box. To update the brand list or add project case studies,
  either edit those PHP files directly (the arrays near the top of each
  file — `$brands_by_category` and `$projects` — are plain, commented
  lists) or ask a developer to do it / convert them into a normal editable
  format (e.g. a custom post type) if you'll be updating them often.
- **Home**, **Blog posts** — fully editable normally.

---

## Adding a blog post

`Posts → Add New` — works exactly like a normal WordPress post. Add a
featured image for the card thumbnail on the blog index.

---

## Managing translations (Arabic / English)

The theme ships English text plus a starter Arabic translation for the
most common buttons/labels (~60 strings) in
`/theme/kanz-corner/languages`. Everything else — product names,
descriptions, page content, blog posts — is regular WordPress content, so
however you translate it depends on which plugin you installed:

- **WPML**: `WPML → Translation Management` to send content for
  translation (yourself or a translator), and `WPML → Theme and plugin
  localization` to scan/translate any remaining theme UI strings.
- **Polylang**: duplicate each page/post into its Arabic counterpart via
  the language box in the post editor, and use `Languages → Translations`
  for UI strings.

Either way, get the Arabic text checked by a native speaker before
launch — machine or first-draft translations are a reasonable starting
point but shouldn't be the final copy on a commercial site.

---

## Newsletter signups

The footer has a basic built-in signup form that stores emails as a
WordPress option (`Settings` are not exposed in the UI for this — it's
intentionally minimal). Once you're ready to actually run email
campaigns, install **Mailchimp for WooCommerce** (or Klaviyo/Brevo) and
paste its signup shortcode into `Customizer → Footer & Newsletter →
Newsletter signup shortcode` — that automatically replaces the basic form.

---

## Something looks broken — quick checks

- **A page 404s**: make sure a Page exists with the exact slug listed in
  DEPLOYMENT-GUIDE.md section 6.
- **"Request Quote" shows on a product you priced**: check the "Pricing
  Mode" box in that product's edit screen isn't ticked.
- **Arabic text/layout looks off**: confirm your multilingual plugin
  (WPML/Polylang) is active and the page has an Arabic translation —
  the theme's RTL styling only activates when the site is actually
  serving an RTL language.
- **Emails aren't arriving** (quote requests, order confirmations):
  Hostinger shared hosting's default PHP `mail()` is unreliable for
  deliverability. Install **WP Mail SMTP** and connect it to a real
  mail provider (Gmail, Brevo, SendGrid, etc.) — this is a very common
  fix and worth doing at launch, not just if you notice a problem.
