-- Quality & Certifications: richer certification records, per-product approval evidence/scope, admin-only management, /quality footer link.

-- ───────── Certification records ─────────
alter table certifications
  add column if not exists logo_path text,                    -- official logo uploaded by an admin (bucket site-icons)
  add column if not exists description_en text,
  add column if not exists description_ar text,
  add column if not exists verification_url text,
  add column if not exists holder text,                       -- certificate holder / manufacturer
  add column if not exists scope text not null default 'company',
  add column if not exists issued_at date,
  add column if not exists show_on_quality boolean not null default true;
alter table certifications drop constraint if exists certifications_scope_check;
alter table certifications add constraint certifications_scope_check check (scope in ('company', 'manufacturer', 'product'));
alter table certifications drop constraint if exists certifications_verification_url_check;
alter table certifications add constraint certifications_verification_url_check check (verification_url is null or (verification_url ~* '^https://[^\s]+$' and char_length(verification_url) <= 500));
alter table certifications drop constraint if exists certifications_dates_check;
alter table certifications add constraint certifications_dates_check check (issued_at is null or valid_until is null or valid_until >= issued_at);

-- ───────── Product ↔ certification assignment (evidence and scope live here) ─────────
alter table product_certifications
  add column if not exists status text not null default 'pending',
  add column if not exists reference_number text,
  add column if not exists document_path text,                -- product-specific certificate PDF (bucket product-docs)
  add column if not exists verification_url text,
  add column if not exists scope_note text,                   -- e.g. "Sizes 2"–8" only"
  add column if not exists variant_ids uuid[] not null default '{}',   -- empty = all variants of the product
  add column if not exists updated_at timestamptz not null default now();
alter table product_certifications drop constraint if exists product_certifications_status_check;
alter table product_certifications add constraint product_certifications_status_check check (status in ('verified', 'pending', 'not_available', 'not_applicable'));
alter table product_certifications drop constraint if exists product_certifications_url_check;
alter table product_certifications add constraint product_certifications_url_check check (verification_url is null or (verification_url ~* '^https://[^\s]+$' and char_length(verification_url) <= 500));
alter table product_certifications drop constraint if exists product_certifications_note_check;
alter table product_certifications add constraint product_certifications_note_check check (scope_note is null or char_length(scope_note) <= 300);
-- Anything assigned before this migration stays 'pending' until an admin verifies it (nothing becomes public by accident).

-- ───────── Access: only administrators manage certifications; the public sees only live, verified data ─────────
drop policy if exists "certifications public read" on certifications;
drop policy if exists "certifications staff insert" on certifications;
drop policy if exists "certifications staff update" on certifications;
drop policy if exists "certifications admin delete" on certifications;
drop policy if exists "certifications admin insert" on certifications;
drop policy if exists "certifications admin update" on certifications;
create policy "certifications public read" on certifications for select
  using ((is_active and (valid_until is null or valid_until >= current_date) and (issued_at is null or issued_at <= current_date)) or is_staff());
create policy "certifications admin insert" on certifications for insert with check (is_admin());
create policy "certifications admin update" on certifications for update using (is_admin()) with check (is_admin());
create policy "certifications admin delete" on certifications for delete using (is_admin());

drop policy if exists "product_certs public read" on product_certifications;
drop policy if exists "product_certs staff write" on product_certifications;
drop policy if exists "product_certs admin write" on product_certifications;
create policy "product_certs public read" on product_certifications for select
  using ((status = 'verified' and exists (select 1 from products p where p.id = product_id and p.status = 'published')) or is_staff());
create policy "product_certs admin write" on product_certifications for all using (is_admin()) with check (is_admin());

-- ───────── Footer link to the new page (only if it is not there yet) ─────────
insert into menu_links (menu, label_en, label_ar, url, sort_order)
select 'footer_company', 'Quality & Certifications', 'الجودة والشهادات', '/quality', 15
where not exists (select 1 from menu_links where menu = 'footer_company' and url = '/quality');
