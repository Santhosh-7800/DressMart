-- ============================================================================
-- DressMart — Wishlist Collections
-- Purely additive: does not alter the existing wishlist_items table, its data,
-- or its RLS policies. A collection just tracks which already-wishlisted
-- product ids have been filed into it; the underlying wishlist (add/remove
-- via the heart button) keeps working exactly as before.
-- ============================================================================

create table wishlist_collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  share_slug text unique,
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishlist_collections_user_idx on wishlist_collections (user_id);

alter table wishlist_collections enable row level security;

create policy "owner full access to wishlist collections" on wishlist_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Separate, additive read policy: a shared collection (share_slug set) is
-- publicly viewable by its link, regardless of who's asking.
create policy "shared wishlist collections are publicly readable" on wishlist_collections
  for select using (share_slug is not null);

create trigger wishlist_collections_set_updated_at before update on wishlist_collections
  for each row execute procedure set_updated_at();
