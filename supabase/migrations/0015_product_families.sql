-- 0015: one product page per product family with a manufacturer (brand) selector.
-- Product family -> manufacturer offerings (existing products, one per brand) -> variants -> dimension tables / drawings / documents.
-- Additive only: no existing product data is changed, except the Delcorte brand display name (decision: "JD Delcorte").

-- ───────── Family page content ─────────
alter table product_families
  add column if not exists short_desc_en text, add column if not exists short_desc_ar text,
  add column if not exists description_en text, add column if not exists description_ar text,
  add column if not exists image_path text,                       -- KANZ's own photo (manufacturer photos are not used)
  add column if not exists status text not null default 'draft',
  add column if not exists published_at timestamptz,
  add column if not exists sort_order int not null default 0,
  add column if not exists seo_title_en text, add column if not exists seo_title_ar text,
  add column if not exists seo_desc_en text, add column if not exists seo_desc_ar text,
  add column if not exists seo_noindex boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table product_families add constraint product_families_status_check check (status in ('draft', 'published'));
exception when duplicate_object then null; end $$;

-- ───────── Offering link: a product joins its family page only after an admin confirms it ─────────
alter table products
  add column if not exists family_link text not null default 'suggested',
  add column if not exists family_sort int not null default 0;
do $$ begin
  alter table products add constraint products_family_link_check check (family_link in ('suggested', 'confirmed', 'rejected'));
exception when duplicate_object then null; end $$;
create index if not exists products_family_idx on products(family_id) where family_id is not null;

-- ───────── Match suggestions (import / scan), reviewed in Admin -> Product families ─────────
create table if not exists family_link_suggestions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  family_id uuid not null references product_families(id) on delete cascade,
  confidence text not null check (confidence in ('exact', 'likely', 'uncertain')),
  reasons jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references profiles(id), decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, family_id)
);

-- ───────── One URL namespace: /[lang]/product/<slug> serves a family or a product, so slugs must never clash ─────────
create or replace function check_family_product_slug() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'product_families' and exists (select 1 from products where slug = new.slug) then
    raise exception 'The address "%" is already used by a product', new.slug using errcode = '23505';
  elsif tg_table_name = 'products' and exists (select 1 from product_families where slug = new.slug) then
    raise exception 'The address "%" is already used by a product family', new.slug using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists product_families_slug_unique on product_families;
create trigger product_families_slug_unique before insert or update of slug on product_families for each row execute function check_family_product_slug();
drop trigger if exists products_family_slug_unique on products;
create trigger products_family_slug_unique before insert or update of slug on products for each row execute function check_family_product_slug();
-- a family's old address keeps working after a rename (same redirect table as products, same URL namespace)
drop trigger if exists product_families_slug_redirect on product_families;
create trigger product_families_slug_redirect after update of slug on product_families for each row execute function record_slug_change('product');
drop trigger if exists product_families_updated on product_families;
create trigger product_families_updated before update on product_families for each row execute function set_updated_at();

-- ───────── Access ─────────
drop policy if exists "families public read" on product_families;
create policy "families public read" on product_families for select using (status = 'published' or is_staff());
alter table family_link_suggestions enable row level security;
drop policy if exists "family suggestions staff only" on family_link_suggestions;
create policy "family suggestions staff only" on family_link_suggestions for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on family_link_suggestions to authenticated;

-- ───────── Brand display name (owner's decision) ─────────
update brands set name = 'JD Delcorte' where slug = 'delcorte' and name = 'Delcorte';
update products set name_en = 'JD ' || name_en
 where brand_id = (select id from brands where slug = 'delcorte') and name_en like 'Delcorte %' and status = 'draft';
