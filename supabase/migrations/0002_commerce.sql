-- Orders, payments, delivery, invoices, RFQs

create type order_status as enum ('pending','confirmed','processing','ready_for_pickup','shipped','delivered','completed','cancelled','refunded');
create type payment_status as enum ('unpaid','pending','paid','partially_paid','failed','refunded');
create type payment_method as enum ('bank_transfer','cod','card','mada','apple_pay','stc_pay','credit_account','other');
create type delivery_method as enum ('delivery','pickup');
create type rfq_status as enum ('submitted','under_review','quoted','accepted','rejected','expired','converted','cancelled');

-- ───────── Settings used by commerce (VAT etc.) ─────────
create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Public-readable subset is exposed via view public_settings (see RLS migration).

create or replace function setting_numeric(p_key text, p_default numeric) returns numeric language sql stable as $$
  select coalesce((select (value #>> '{}')::numeric from site_settings where key = p_key), p_default)
$$;

-- ───────── Document numbering ─────────
create sequence rfq_seq; create sequence order_seq; create sequence invoice_seq;
create or replace function next_doc_number(p_prefix text, p_seq regclass) returns text language sql as $$
  select p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(nextval(p_seq)::text, 6, '0')
$$;

-- ───────── Addresses ─────────
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text,
  recipient text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text,
  country text not null default 'SA',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on addresses(user_id);

-- ───────── Orders ─────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default next_doc_number('ORD', 'order_seq'),
  user_id uuid references profiles(id) on delete set null,
  rfq_id uuid,                                    -- set when converted from a quotation
  status order_status not null default 'pending',
  payment_status payment_status not null default 'unpaid',
  payment_method payment_method not null default 'bank_transfer',
  delivery_method delivery_method not null default 'delivery',
  currency text not null default 'SAR',
  vat_rate numeric(5,2) not null,                 -- snapshot of configured VAT at order time
  subtotal numeric(14,2) not null,                -- ex-VAT
  shipping_total numeric(14,2) not null default 0,
  vat_total numeric(14,2) not null,
  grand_total numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  company_name text,
  customer_vat_number text,
  shipping_address jsonb,
  notes text,
  stock_fulfilled boolean not null default false,
  warehouse_id uuid references warehouses(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders(user_id);
create index on orders(created_at desc);
create index on orders(status);
create trigger trg_orders_updated before update on orders for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  sku text,
  name_en text not null,
  name_ar text,
  spec_summary text,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),   -- ex-VAT
  line_total numeric(14,2) not null
);
create index on order_items(order_id);
-- Cost snapshot per line for profit tracking (staff-only; customers can read order_items).
create table order_item_costs (
  order_item_id uuid primary key references order_items(id) on delete cascade,
  unit_cost numeric(14,4) not null
);
create index on order_items(product_id);

create table order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  note text,
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null,
  amount numeric(14,2) not null check (amount > 0),
  status payment_status not null default 'paid',
  gateway text,                  -- e.g. 'hyperpay','moyasar','tap','payfort' (architecture only; none enabled by default)
  gateway_reference text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references profiles(id),
  note text
);
create index on payments(order_id);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text not null default 'preparing' check (status in ('preparing','dispatched','in_transit','delivered','returned')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index on shipments(order_id);

-- ───────── Invoices (VAT invoice; ZATCA-ready fields, NOT claiming compliance) ─────────
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default next_doc_number('INV', 'invoice_seq'),
  order_id uuid not null references orders(id) on delete restrict,
  issued_at timestamptz not null default now(),
  seller_snapshot jsonb not null,        -- legal name, VAT no, CR, address at issue time
  buyer_snapshot jsonb not null,
  vat_rate numeric(5,2) not null,
  subtotal numeric(14,2) not null,
  vat_total numeric(14,2) not null,
  grand_total numeric(14,2) not null,
  -- ZATCA preparation (all null until a verified integration is built and certified):
  zatca_status text not null default 'not_integrated' check (zatca_status in ('not_integrated','pending','reported','cleared','rejected')),
  zatca_uuid uuid,
  zatca_hash text,
  zatca_qr text,
  zatca_xml_path text,
  created_by uuid references profiles(id)
);
create index on invoices(order_id);
-- Issued invoices are immutable (no UPDATE of amounts); enforced below.
create or replace function invoices_immutable() returns trigger language plpgsql as $$
begin
  if (new.subtotal, new.vat_total, new.grand_total, new.invoice_number, new.order_id, new.vat_rate)
     is distinct from (old.subtotal, old.vat_total, old.grand_total, old.invoice_number, old.order_id, old.vat_rate) then
    raise exception 'Issued invoices cannot be modified; issue a credit note instead';
  end if;
  return new;
end $$;
create trigger trg_invoices_immutable before update on invoices for each row execute function invoices_immutable();

-- ───────── RFQ / quotations ─────────
create table rfqs (
  id uuid primary key default gen_random_uuid(),
  rfq_number text not null unique default next_doc_number('RFQ', 'rfq_seq'),
  user_id uuid references profiles(id) on delete set null,   -- null for guest RFQs
  status rfq_status not null default 'submitted',
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  company_name text,
  vat_number text,
  delivery_city text,
  required_by date,
  customer_notes text,
  -- quotation fields (filled by admin)
  quote_valid_until date,
  lead_time text,
  payment_terms text,
  delivery_terms text,
  quote_notes text,
  vat_rate numeric(5,2),
  quoted_subtotal numeric(14,2),
  quoted_vat numeric(14,2),
  quoted_total numeric(14,2),
  quoted_at timestamptz,
  quoted_by uuid references profiles(id),
  converted_order_id uuid references orders(id),
  access_token uuid not null default gen_random_uuid(),     -- lets guests view their quote via emailed link
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on rfqs(user_id);
create index on rfqs(status);
create trigger trg_rfqs_updated before update on rfqs for each row execute function set_updated_at();
alter table orders add constraint orders_rfq_fk foreign key (rfq_id) references rfqs(id) on delete set null;

create table rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references rfqs(id) on delete cascade,
  line_no int not null default 1,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  description text not null,                 -- free text or product name snapshot
  specification text,                        -- size / grade / schedule / standard requested
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'pcs',
  quoted_unit_price numeric(14,2) check (quoted_unit_price is null or quoted_unit_price >= 0),
  quoted_lead_time text,
  line_note text
);
create index on rfq_items(rfq_id);

create table rfq_events (
  id bigint generated always as identity primary key,
  rfq_id uuid not null references rfqs(id) on delete cascade,
  event text not null,                       -- 'submitted','status:quoted','price_updated','pdf_generated','converted',...
  detail text,
  actor uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on rfq_events(rfq_id, created_at);

create table rfq_attachments (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references rfqs(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- ───────── Staff-only internal notes (orders, RFQs, products...) ─────────
create table internal_notes (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('order','rfq','customer','product')),
  entity_id uuid not null,
  note text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on internal_notes(entity, entity_id);
