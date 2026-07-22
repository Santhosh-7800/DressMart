-- ============================================================================
-- DressMart — Row Level Security policies
-- Public catalog data is readable by anyone; personal data is scoped to the
-- owning user; write access to catalog/management tables is restricted to admins.
-- ============================================================================

create function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles are viewable by owner or admin" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "profiles are updatable by owner" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- CATALOG (public read, admin write)
-- ----------------------------------------------------------------------------
alter table brands enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table banners enable row level security;
alter table coupons enable row level security;

create policy "brands are publicly readable" on brands for select using (true);
create policy "brands are writable by admin" on brands for all using (is_admin()) with check (is_admin());

create policy "categories are publicly readable" on categories for select using (true);
create policy "categories are writable by admin" on categories for all using (is_admin()) with check (is_admin());

create policy "active products are publicly readable" on products for select using (is_active or is_admin());
create policy "products are writable by admin" on products for all using (is_admin()) with check (is_admin());

create policy "variants are publicly readable" on product_variants for select using (true);
create policy "variants are writable by admin" on product_variants for all using (is_admin()) with check (is_admin());

create policy "images are publicly readable" on product_images for select using (true);
create policy "images are writable by admin" on product_images for all using (is_admin()) with check (is_admin());

create policy "active banners are publicly readable" on banners for select using (is_active or is_admin());
create policy "banners are writable by admin" on banners for all using (is_admin()) with check (is_admin());

create policy "active coupons are publicly readable" on coupons for select using (is_active or is_admin());
create policy "coupons are writable by admin" on coupons for all using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------------------------
-- REVIEWS (public read, owner write)
-- ----------------------------------------------------------------------------
alter table reviews enable row level security;

create policy "reviews are publicly readable" on reviews for select using (true);
create policy "users can write their own reviews" on reviews
  for insert with check (auth.uid() = user_id);
create policy "users can update their own reviews" on reviews
  for update using (auth.uid() = user_id);
create policy "users or admin can delete reviews" on reviews
  for delete using (auth.uid() = user_id or is_admin());

-- ----------------------------------------------------------------------------
-- PERSONAL DATA (owner-only access)
-- ----------------------------------------------------------------------------
alter table addresses enable row level security;
alter table cart_items enable row level security;
alter table wishlist_items enable row level security;
alter table saved_payment_methods enable row level security;
alter table notifications enable row level security;

create policy "owner full access to addresses" on addresses
  for all using (auth.uid() = user_id or is_admin()) with check (auth.uid() = user_id);

create policy "owner full access to cart" on cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner full access to wishlist" on wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner full access to saved payment methods" on saved_payment_methods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can read own notifications" on notifications
  for select using (auth.uid() = user_id or is_admin());
create policy "owner can update own notifications" on notifications
  for update using (auth.uid() = user_id);
create policy "admin can insert notifications" on notifications
  for insert with check (is_admin() or auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- ORDERS (owner read, admin manage)
-- ----------------------------------------------------------------------------
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_timeline_events enable row level security;
alter table returns enable row level security;

create policy "owner or admin can read orders" on orders
  for select using (auth.uid() = user_id or is_admin());
create policy "owner can place orders" on orders
  for insert with check (auth.uid() = user_id);
create policy "owner can cancel own order or admin can update" on orders
  for update using (auth.uid() = user_id or is_admin());

create policy "owner or admin can read order items" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and (orders.user_id = auth.uid() or is_admin()))
  );
create policy "owner can insert order items for own order" on order_items
  for insert with check (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );
create policy "admin can update order items" on order_items
  for update using (is_admin());

create policy "owner or admin can read timeline" on order_timeline_events
  for select using (
    exists (select 1 from orders where orders.id = order_timeline_events.order_id and (orders.user_id = auth.uid() or is_admin()))
  );
create policy "admin can manage timeline" on order_timeline_events
  for all using (is_admin()) with check (is_admin());

create policy "owner or admin can read returns" on returns
  for select using (auth.uid() = user_id or is_admin());
create policy "owner can request a return" on returns
  for insert with check (auth.uid() = user_id);
create policy "admin can update return status" on returns
  for update using (is_admin());
