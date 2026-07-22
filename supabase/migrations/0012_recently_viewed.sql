-- ============================================================================
-- DressMart — Recently Viewed Products
-- Purely additive: one new table. viewed_at is bumped via upsert on re-view
-- (see recentlyViewedService.recordView), so the same product never appears
-- twice for a user.
-- ============================================================================

create table recently_viewed_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index recently_viewed_items_user_idx on recently_viewed_items (user_id, viewed_at desc);

alter table recently_viewed_items enable row level security;

create policy "owner can read their recently viewed items" on recently_viewed_items
  for select using (auth.uid() = user_id);
create policy "owner can insert their recently viewed items" on recently_viewed_items
  for insert with check (auth.uid() = user_id);
create policy "owner can update their recently viewed items" on recently_viewed_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner can delete their recently viewed items" on recently_viewed_items
  for delete using (auth.uid() = user_id);
