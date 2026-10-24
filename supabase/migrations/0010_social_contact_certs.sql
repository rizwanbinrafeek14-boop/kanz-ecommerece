-- Admin-managed contact widget (WhatsApp + call), social links, and certifications shown on product pages.

-- ───────── Floating contact widget (single row) ─────────
create table contact_widget (
  id smallint primary key default 1 check (id = 1),
  whatsapp_enabled boolean not null default true,
  whatsapp_number text not null default '' check (whatsapp_number ~ '^(\d{8,15})?$'),   -- international format, digits only, no +
  default_message_en text not null default 'Hello KANZ CORNER, I would like to enquire about your products.',
  default_message_ar text not null default 'مرحباً كنز كورنر، أود الاستفسار عن منتجاتكم.',
  icon_path text,                                   -- custom icon in bucket site-icons; null = built-in WhatsApp icon
  position text not null default 'right' check (position in ('left', 'right')),
  show_desktop boolean not null default true,
  show_mobile boolean not null default true,
  label_en text not null default 'Chat on WhatsApp',
  label_ar text not null default 'تواصل عبر واتساب',
  description_en text not null default 'Opens a WhatsApp chat with KANZ CORNER in a new tab',
  description_ar text not null default 'يفتح محادثة واتساب مع كنز كورنر في نافذة جديدة',
  menu_label_en text not null default 'Contact us',
  menu_label_ar text not null default 'تواصل معنا',
  show_call boolean not null default true,
  call_number text not null default '' check (call_number ~ '^(\+?\d{6,16})?$'),          -- empty = use the company phone setting
  updated_at timestamptz not null default now()
);
insert into contact_widget (id) values (1);
-- Carry over the WhatsApp number already stored in Company settings (it was public on the site already).
update contact_widget set whatsapp_number = coalesce((select regexp_replace(value #>> '{}', '\D', '', 'g') from site_settings where key = 'public.company_whatsapp'), '')
  where exists (select 1 from site_settings where key = 'public.company_whatsapp' and (value #>> '{}') ~ '^\+?\d{8,15}$');

-- ───────── Social links ─────────
create table social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram','facebook','linkedin','x','youtube','tiktok','snapchat','custom')),
  name text not null check (char_length(name) between 1 and 60),
  url text not null check (url ~* '^https://[^\s]+$' and char_length(url) <= 500),
  icon_path text,                                    -- uploaded icon (bucket site-icons); null = built-in icon for the platform
  accessible_label text not null check (char_length(accessible_label) between 1 and 120),
  sort_order int not null default 0,
  is_active boolean not null default true,
  show_header boolean not null default false,
  show_footer boolean not null default true,
  show_mobile_menu boolean not null default false,
  show_floating boolean not null default false,
  created_at timestamptz not null default now()
);
create index on social_links (sort_order);

-- ───────── Certifications (only what the business really holds; entered by staff) ─────────
create table certifications (
  id uuid primary key default gen_random_uuid(),
  name_en text not null, name_ar text,
  issuer text,
  reference_number text,
  valid_until date,
  document_path text,                                -- supporting document in bucket product-docs (public)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table product_certifications (
  product_id uuid not null references products(id) on delete cascade,
  certification_id uuid not null references certifications(id) on delete cascade,
  primary key (product_id, certification_id)
);

alter table contact_widget enable row level security;
alter table social_links enable row level security;
alter table certifications enable row level security;
alter table product_certifications enable row level security;

create policy "contact_widget public read" on contact_widget for select using (true);
create policy "contact_widget staff update" on contact_widget for update using (is_staff()) with check (is_staff());
create policy "social_links public read" on social_links for select using (is_active or is_staff());
create policy "social_links staff insert" on social_links for insert with check (is_staff());
create policy "social_links staff update" on social_links for update using (is_staff()) with check (is_staff());
create policy "social_links staff delete" on social_links for delete using (is_staff());
create policy "certifications public read" on certifications for select using ((is_active and (valid_until is null or valid_until >= current_date)) or is_staff());
create policy "certifications staff insert" on certifications for insert with check (is_staff());
create policy "certifications staff update" on certifications for update using (is_staff()) with check (is_staff());
create policy "certifications admin delete" on certifications for delete using (is_admin());
create policy "product_certs public read" on product_certifications for select
  using (exists (select 1 from products p where p.id = product_id and p.status = 'published') or is_staff());
create policy "product_certs staff write" on product_certifications for all using (is_staff()) with check (is_staff());

-- Icon storage (public read by URL; only staff can write). SVGs are sanitised by the server before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-icons', 'site-icons', true, 524288, array['image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "site icons staff write" on storage.objects for all
  using (bucket_id = 'site-icons' and is_staff()) with check (bucket_id = 'site-icons' and is_staff());

grant select on contact_widget, social_links, certifications, product_certifications to anon;
grant select, insert, update, delete on contact_widget, social_links, certifications, product_certifications to authenticated;
