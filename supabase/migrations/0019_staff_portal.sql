-- ============================================================================
-- DressMart — Staff Portal: a third, fully isolated application (alongside the
-- Customer Store and Admin Panel) for in-shop staff to submit products for
-- Admin approval. Staff can add products but never edit Admin's products,
-- never delete anything, and never touch orders/customers/reports/coupons.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Products: provenance + approval workflow columns. Every existing row
-- defaults to created_by='admin' / approval_status='approved' so nothing
-- already in the catalog is ever hidden or reassigned by this migration.
-- ----------------------------------------------------------------------------
alter table products add column if not exists created_by text not null default 'admin' check (created_by in ('admin', 'staff'));
alter table products add column if not exists created_by_id uuid references profiles(id) on delete set null;
alter table products add column if not exists shop_name text;
alter table products add column if not exists approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected'));
alter table products add column if not exists updated_at timestamptz not null default now();

-- Customer-facing visibility now requires BOTH is_active and an approved review — a pending or
-- rejected staff product must never appear in the store no matter its is_active value. Staff can
-- still read their own row (any status) so their dashboard shows pending/rejected products.
drop policy if exists "active products are publicly readable" on products;
create policy "active products are publicly readable" on products
  for select using ((is_active and approval_status = 'approved') or is_admin() or created_by_id = auth.uid());

-- Staff may submit new products (always as themselves, always starting pending) and edit their
-- own later — but never delete, and never touch a row they didn't create (enforced by the
-- `created_by_id = auth.uid()` check, not just is_staff_or_admin()). The existing "products are
-- writable by admin" policy (is_admin(), for all) is untouched and still gives admin unrestricted
-- insert/update/delete — Postgres OR's multiple permissive policies together, so this only adds
-- staff's narrower path, it doesn't loosen the admin one.
drop policy if exists "staff can submit own products" on products;
create policy "staff can submit own products" on products
  for insert with check (
    created_by = 'staff' and created_by_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'staff')
  );

drop policy if exists "staff can edit own products" on products;
create policy "staff can edit own products" on products
  for update using (created_by = 'staff' and created_by_id = auth.uid())
  with check (created_by = 'staff' and created_by_id = auth.uid());

-- Staff need to be able to write their own variants/images too (same "own rows only" shape).
drop policy if exists "staff can write variants for own products" on product_variants;
create policy "staff can write variants for own products" on product_variants
  for all using (exists (select 1 from products where products.id = product_variants.product_id and products.created_by_id = auth.uid()))
  with check (exists (select 1 from products where products.id = product_variants.product_id and products.created_by_id = auth.uid()));

drop policy if exists "staff can write images for own products" on product_images;
create policy "staff can write images for own products" on product_images
  for all using (exists (select 1 from products where products.id = product_images.product_id and products.created_by_id = auth.uid()))
  with check (exists (select 1 from products where products.id = product_images.product_id and products.created_by_id = auth.uid()));

-- Staff upload product photos too, not just admin.
drop policy if exists "product images are writable by admin" on storage.objects;
create policy "product images are writable by staff or admin" on storage.objects
  for all using (bucket_id = 'product-images' and is_staff_or_admin()) with check (bucket_id = 'product-images' and is_staff_or_admin());

-- ----------------------------------------------------------------------------
-- staff: per-staff-member details (shop_name/phone/status) that don't belong
-- on the shared `profiles` row used by every role. 1:1 with profiles.
-- ----------------------------------------------------------------------------
create table if not exists staff (
  id uuid primary key references profiles(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  shop_name text not null default '',
  role text not null default 'staff',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

alter table staff enable row level security;

drop policy if exists "staff can read own row" on staff;
create policy "staff can read own row" on staff
  for select using (id = auth.uid() or is_admin());

drop policy if exists "staff can update own row" on staff;
create policy "staff can update own row" on staff
  for update using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

drop policy if exists "admin manages staff directory" on staff;
create policy "admin manages staff directory" on staff
  for insert with check (is_admin() or id = auth.uid());

drop policy if exists "admin can delete staff rows" on staff;
create policy "admin can delete staff rows" on staff for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- staff_products: audit trail linking each staff-submitted product to the
-- staff member who created it and its approval history (products.approval_status
-- is the live/current value; this table is the record of who submitted what).
-- ----------------------------------------------------------------------------
create table if not exists staff_products (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table staff_products enable row level security;

drop policy if exists "staff can read own submissions" on staff_products;
create policy "staff can read own submissions" on staff_products
  for select using (staff_id = auth.uid() or is_admin());

drop policy if exists "staff can create own submissions" on staff_products;
create policy "staff can create own submissions" on staff_products
  for insert with check (staff_id = auth.uid());

drop policy if exists "admin manages submissions" on staff_products;
create policy "admin manages submissions" on staff_products
  for update using (is_admin()) with check (is_admin());

drop policy if exists "admin can delete submissions" on staff_products;
create policy "admin can delete submissions" on staff_products for delete using (is_admin());
