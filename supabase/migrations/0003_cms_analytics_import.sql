-- CMS (banners, homepage, menus), analytics, catalogue import staging, audit log

create type banner_placement as enum ('home_hero','home_secondary','home_strip','category_top','sidebar','popup');

create table banners (
  id uuid primary key default gen_random_uuid(),
  placement banner_placement not null default 'home_hero',
  title_en text, title_ar text,
  subtitle_en text, subtitle_ar text,
  cta_label_en text, cta_label_ar text,
  desktop_image_path text,
  mobile_image_path text,
  alt_en text, alt_ar text,
  link_url text,
  category_id uuid references categories(id) on delete set null,   -- for category_top placement
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order int not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index on banners(placement, sort_order);
create trigger trg_banners_updated before update on banners for each row execute function set_updated_at();

create table homepage_sections (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('hero','category_cards','featured_products','new_arrivals','best_sellers','special_offers','brands','announcement','why_us','rfq_cta','custom_html')),
  title_en text, title_ar text,
  subtitle_en text, subtitle_ar text,
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  text_en text not null, text_ar text,
  link_url text,
  starts_at timestamptz, ends_at timestamptz,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table menu_links (
  id uuid primary key default gen_random_uuid(),
  menu text not null check (menu in ('header','footer_company','footer_products','footer_support','footer_legal')),
  label_en text not null, label_ar text,
  url text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ───────── Analytics (first-party, privacy-light) ─────────
create table analytics_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('page_view','product_view','search','banner_impression','banner_click','add_to_cart','rfq_submit','whatsapp_click')),
  session_id text not null,                  -- random id from first-party cookie; no IP stored
  path text,
  product_id uuid references products(id) on delete set null,
  banner_id uuid references banners(id) on delete set null,
  query text,
  lang text,
  created_at timestamptz not null default now()
);
create index on analytics_events(event, created_at desc);
create index on analytics_events(product_id) where product_id is not null;
create index on analytics_events(created_at desc);

-- ───────── Catalogue import staging ─────────
create type import_item_status as enum ('pending','approved','rejected','published');

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,                 -- e.g. kanz-CATALOGE.pdf
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches(id) on delete cascade,
  status import_item_status not null default 'pending',
  source_page int,
  -- Extracted, UNVERIFIED data. Editable in the review screen before publishing.
  name_en text not null,
  name_ar text,
  suggested_category_slug text,
  suggested_sku text,                        -- left null unless the catalogue prints a real SKU
  description_en text,
  specs jsonb not null default '{}'::jsonb,  -- {size:[...],grade:[...],schedule:[...],standard:[...],brand:[...]}
  image_path text,                           -- bucket import-staging
  flags text[] not null default '{}',        -- e.g. {'foreign_branding','verify_specs','no_image','duplicate_name'}
  review_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  published_product_id uuid references products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on import_items(batch_id, status);

-- ───────── Audit log ─────────
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log(created_at desc);
