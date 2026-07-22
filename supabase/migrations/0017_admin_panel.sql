-- ============================================================================
-- DressMart — Admin Panel foundation: roles, catalog-write access, store
-- settings, and product image storage.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Roles: add shop_owner (full backend access, same as admin) and staff
-- (limited operational access — orders/fulfillment only).
-- ----------------------------------------------------------------------------
alter type user_role add value if not exists 'shop_owner';
alter type user_role add value if not exists 'staff';

-- is_admin() already gates every catalog/customer-management write policy (products, brands,
-- categories, banners, coupons, and viewing any customer's own data) — widening its definition
-- here is what makes "shop_owner has the same backend powers as admin" true everywhere at once,
-- with no other policy needing to change.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'shop_owner')
  );
$$;

-- Staff get their own, narrower helper: order fulfillment (accept/pack/ship/deliver/cancel) and
-- read access to what that requires, but not customer PII/wallet/coupon management.
create or replace function is_staff_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'shop_owner', 'staff')
  );
$$;

drop policy if exists "staff can view all orders" on orders;
create policy "staff can view all orders" on orders
  for select using (auth.uid() = user_id or is_staff_or_admin());

drop policy if exists "staff can update order fulfillment status" on orders;
create policy "staff can update order fulfillment status" on orders
  for update using (is_staff_or_admin());

drop policy if exists "staff can view all order items" on order_items;
create policy "staff can view all order items" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
    or is_staff_or_admin()
  );

drop policy if exists "staff can view all returns" on returns;
create policy "staff can view all returns" on returns
  for select using (auth.uid() = user_id or is_staff_or_admin());

-- ----------------------------------------------------------------------------
-- New Product fields surfaced by the admin Product Form.
-- ----------------------------------------------------------------------------
alter table products add column if not exists is_featured boolean not null default false;
alter table products add column if not exists gst_percent numeric(5, 2) not null default 5;
alter table products add column if not exists low_stock_threshold int not null default 5;

-- ----------------------------------------------------------------------------
-- Store settings — a single configurable row, managed from Admin > Settings.
-- ----------------------------------------------------------------------------
create table if not exists store_settings (
  id uuid primary key default uuid_generate_v4(),
  store_name text not null default 'DressMart',
  store_address text not null default '',
  phone text not null default '',
  email text not null default '',
  gst_number text not null default '',
  logo_url text,
  banner_url text,
  shipping_charge numeric(10, 2) not null default 0,
  free_shipping_threshold numeric(10, 2) not null default 999,
  return_policy text not null default '',
  privacy_policy text not null default '',
  updated_at timestamptz not null default now()
);

insert into store_settings (store_name)
select 'DressMart'
where not exists (select 1 from store_settings);

alter table store_settings enable row level security;

drop policy if exists "store settings are publicly readable" on store_settings;
create policy "store settings are publicly readable" on store_settings for select using (true);

drop policy if exists "store settings are writable by admin" on store_settings;
create policy "store settings are writable by admin" on store_settings for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- Product image storage — public read (product photos are public marketing
-- assets), writes restricted to admin/shop_owner.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product images are writable by admin" on storage.objects;
create policy "product images are writable by admin" on storage.objects
  for all using (bucket_id = 'product-images' and is_admin()) with check (bucket_id = 'product-images' and is_admin());
