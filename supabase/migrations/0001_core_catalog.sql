-- KANZ CORNER EST. — core catalogue, roles, inventory
-- Run order: 0001 -> 0002 -> 0003 -> 0004 (RLS) -> seed.sql

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ───────── Enums ─────────
create type app_role as enum ('customer', 'staff', 'admin');
create type product_status as enum ('draft', 'published', 'archived');
create type stock_movement_type as enum ('stock_in', 'stock_out', 'adjustment', 'reserve', 'release', 'transfer_in', 'transfer_out');

-- ───────── Helpers ─────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────── Profiles & roles ─────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'customer',
  full_name text,
  phone text,
  company_name text,
  cr_number text,            -- Commercial Registration
  vat_number text,           -- customer's VAT number (B2B invoices)
  preferred_lang text not null default 'en' check (preferred_lang in ('en','ar')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

-- Create a customer profile automatically for every new auth user.
-- Role is ALWAYS 'customer' here; admins are promoted only via SQL / service role.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone, company_name)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone',
          new.raw_user_meta_data->>'company_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function current_role_name() returns app_role language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid() and is_active), 'customer'::app_role)
$$;
create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active and role in ('staff','admin'))
$$;
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active and role = 'admin')
$$;

-- Prevent users from changing their own role / active flag.
create or replace function protect_profile_privileged_cols() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not (auth.uid() is null or is_admin()) then   -- auth.uid() is null for service role / SQL editor
    raise exception 'Only an admin can change role or active status';
  end if;
  return new;
end $$;
create trigger trg_profiles_protect before update on profiles for each row execute function protect_profile_privileged_cols();

-- ───────── Categories (editable tree) ─────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  slug text not null unique,
  name_en text not null,
  name_ar text,
  description_en text,
  description_ar text,
  image_path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  seo_title_en text, seo_title_ar text, seo_desc_en text, seo_desc_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on categories(parent_id);
create trigger trg_categories_updated before update on categories for each row execute function set_updated_at();

-- ───────── Brands ─────────
create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_ar text,
  logo_path text,
  website text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  show_on_homepage boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────── Attribute definitions (editable filters/specs) ─────────
create table attribute_defs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,          -- e.g. size, material, grade, schedule, pressure_class, standard
  name_en text not null,
  name_ar text,
  is_filterable boolean not null default true,
  show_in_specs boolean not null default true,
  sort_order int not null default 0
);

-- ───────── Products (a "family" until it has sellable variants) ─────────
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text,                              -- optional family-level SKU; never auto-invented
  barcode text,
  name_en text not null,
  name_ar text,
  short_desc_en text, short_desc_ar text,
  description_en text, description_ar text,
  category_id uuid references categories(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  status product_status not null default 'draft',
  is_quote_only boolean not null default true,   -- true until real price + stock exist
  is_featured boolean not null default false,
  is_new_arrival boolean not null default false,
  is_special_offer boolean not null default false,
  offer_label_en text, offer_label_ar text,
  base_price numeric(14,2) check (base_price is null or base_price >= 0),  -- SAR, ex-VAT
  compare_at_price numeric(14,2),
  unit text not null default 'pcs',
  min_order_qty numeric(12,2) not null default 1,
  view_count bigint not null default 0,
  source_page int,                       -- catalogue page this family came from
  seo_title_en text, seo_title_ar text, seo_desc_en text, seo_desc_ar text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_sku_uq on products (lower(sku)) where sku is not null;
create index on products (category_id);
create index on products (brand_id);
create index on products (status);
create index products_name_trgm on products using gin ((name_en || ' ' || coalesce(name_ar,'')) gin_trgm_ops);
create trigger trg_products_updated before update on products for each row execute function set_updated_at();

create or replace function products_set_published_at() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end $$;
create trigger trg_products_published before insert or update on products for each row execute function products_set_published_at();

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,            -- path inside bucket product-images
  alt_en text, alt_ar text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  needs_hires boolean not null default false,   -- extracted from catalogue, replace with original
  created_at timestamptz not null default now()
);
create index on product_images(product_id, sort_order);

create table product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  kind text not null check (kind in ('datasheet','mtc','certificate','other')),
  title text not null,
  storage_path text not null,
  is_public boolean not null default true,   -- MTCs are usually false (shown on request)
  created_at timestamptz not null default now()
);
create index on product_documents(product_id);

create table product_attribute_values (
  product_id uuid not null references products(id) on delete cascade,
  attribute_id uuid not null references attribute_defs(id) on delete cascade,
  value_en text not null,
  value_ar text,
  sort_order int not null default 0,
  primary key (product_id, attribute_id, value_en)
);
create index on product_attribute_values(attribute_id, value_en);

-- Sellable SKUs (size/grade/schedule combos). Only these hold stock & prices.
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null,
  barcode text,
  label_en text, label_ar text,
  size text, grade text, schedule text, pressure_class text, material text,
  price numeric(14,2) check (price is null or price >= 0),   -- SAR ex-VAT, overrides product.base_price
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index variants_sku_uq on product_variants (lower(sku));
create unique index variants_barcode_uq on product_variants (barcode) where barcode is not null;
create index on product_variants(product_id);
create trigger trg_variants_updated before update on product_variants for each row execute function set_updated_at();

-- Purchase costs live in staff-only tables (RLS cannot hide single columns from customers).
create table product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  purchase_cost numeric(14,2) not null check (purchase_cost >= 0)
);
create table variant_costs (
  variant_id uuid primary key references product_variants(id) on delete cascade,
  purchase_cost numeric(14,2) not null check (purchase_cost >= 0)
);

-- Duplicate SKU detection across family-level and variant SKUs.
create or replace function sku_in_use(p_sku text, p_exclude_product uuid default null, p_exclude_variant uuid default null)
returns boolean language sql stable as $$
  select exists (select 1 from products where lower(sku) = lower(p_sku) and (p_exclude_product is null or id <> p_exclude_product))
      or exists (select 1 from product_variants where lower(sku) = lower(p_sku) and (p_exclude_variant is null or id <> p_exclude_variant))
$$;

-- Related / alternative products
create table product_relations (
  product_id uuid not null references products(id) on delete cascade,
  related_id uuid not null references products(id) on delete cascade,
  relation text not null default 'related' check (relation in ('related','alternative')),
  sort_order int not null default 0,
  primary key (product_id, related_id, relation),
  check (product_id <> related_id)
);

-- ───────── Inventory ─────────
create table warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text,
  is_default boolean not null default false,
  is_active boolean not null default true
);
create unique index warehouses_one_default on warehouses (is_default) where is_default;

create table stock_levels (
  variant_id uuid not null references product_variants(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  on_hand numeric(14,2) not null default 0,
  reserved numeric(14,2) not null default 0,
  reorder_level numeric(14,2) not null default 0,
  avg_cost numeric(14,4) not null default 0,         -- moving average purchase cost (SAR)
  updated_at timestamptz not null default now(),
  primary key (variant_id, warehouse_id),
  constraint stock_nonneg check (on_hand >= 0 and reserved >= 0),
  constraint stock_no_oversell check (reserved <= on_hand)   -- DB-level overselling protection
);

create table stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references product_variants(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id),
  type stock_movement_type not null,
  quantity numeric(14,2) not null,              -- always positive; direction comes from type
  unit_cost numeric(14,4),
  reason text,
  reference text,                               -- PO number, order number, etc.
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on stock_movements(variant_id, created_at desc);

-- Atomic stock operations. All run as the caller but are SECURITY DEFINER so storefront checkout can reserve.
create or replace function stock_apply(
  p_variant uuid, p_warehouse uuid, p_type stock_movement_type, p_qty numeric,
  p_unit_cost numeric default null, p_reason text default null, p_reference text default null
) returns void language plpgsql security definer set search_path = public as $$
declare lvl stock_levels%rowtype;
begin
  if p_qty is null or p_qty < 0 or (p_qty = 0 and p_type <> 'adjustment') then raise exception 'Quantity must be positive'; end if;   -- an adjustment may set the counted stock to 0
  insert into stock_levels (variant_id, warehouse_id) values (p_variant, p_warehouse) on conflict do nothing;
  select * into lvl from stock_levels where variant_id = p_variant and warehouse_id = p_warehouse for update;

  if p_type in ('stock_in','transfer_in') then
    update stock_levels set
      avg_cost = case when p_unit_cost is null then avg_cost
                      when on_hand + p_qty = 0 then avg_cost
                      else ((on_hand * avg_cost) + (p_qty * p_unit_cost)) / (on_hand + p_qty) end,
      on_hand = on_hand + p_qty, updated_at = now()
    where variant_id = p_variant and warehouse_id = p_warehouse;
  elsif p_type in ('stock_out','transfer_out') then
    if lvl.on_hand - lvl.reserved < p_qty then raise exception 'Insufficient available stock (available %)', lvl.on_hand - lvl.reserved; end if;
    update stock_levels set on_hand = on_hand - p_qty, updated_at = now() where variant_id = p_variant and warehouse_id = p_warehouse;
  elsif p_type = 'adjustment' then
    -- p_qty is the NEW counted on_hand quantity (stocktake); movement stores the absolute new value.
    if p_qty < lvl.reserved then raise exception 'Cannot adjust below reserved quantity (%)', lvl.reserved; end if;
    update stock_levels set on_hand = p_qty, updated_at = now() where variant_id = p_variant and warehouse_id = p_warehouse;
  elsif p_type = 'reserve' then
    if lvl.on_hand - lvl.reserved < p_qty then raise exception 'Insufficient available stock (available %)', lvl.on_hand - lvl.reserved; end if;
    update stock_levels set reserved = reserved + p_qty, updated_at = now() where variant_id = p_variant and warehouse_id = p_warehouse;
  elsif p_type = 'release' then
    update stock_levels set reserved = greatest(reserved - p_qty, 0), updated_at = now() where variant_id = p_variant and warehouse_id = p_warehouse;
  end if;

  insert into stock_movements (variant_id, warehouse_id, type, quantity, unit_cost, reason, reference, created_by)
  values (p_variant, p_warehouse, p_type, p_qty, p_unit_cost, p_reason, p_reference, auth.uid());
end $$;

-- Staff-facing wrapper (checks role). Checkout uses stock_apply via place_order only.
create or replace function staff_stock_apply(
  p_variant uuid, p_warehouse uuid, p_type stock_movement_type, p_qty numeric,
  p_unit_cost numeric default null, p_reason text default null, p_reference text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  if p_type in ('reserve','release') then raise exception 'Reservations are managed by orders'; end if;
  perform stock_apply(p_variant, p_warehouse, p_type, p_qty, p_unit_cost, p_reason, p_reference);
end $$;

-- Per-variant availability (sum across warehouses). Safe to expose publicly: only numbers, no costs.
create or replace view variant_availability with (security_invoker = false) as
  select v.id as variant_id, v.product_id,
         coalesce(sum(s.on_hand - s.reserved), 0) as available
  from product_variants v left join stock_levels s on s.variant_id = v.id
  group by v.id, v.product_id;
