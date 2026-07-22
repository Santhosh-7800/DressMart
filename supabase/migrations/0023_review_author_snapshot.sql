-- ============================================================================
-- DressMart — snapshot the reviewer's name/avatar onto the review itself.
--
-- The `reviews` table never had user_name/user_avatar columns, even though the
-- Review type has carried both since the mock-mode review system was built —
-- in live mode `select('*')` was silently returning them as undefined. Stored
-- as a snapshot (not a live join to profiles) so a review keeps showing the
-- name/photo the reviewer had *at the time they wrote it*, even if they later
-- rename their account or change their avatar — same reasoning as
-- order_items.product_name/brand_name snapshotting product details at
-- purchase time.
-- ============================================================================

alter table reviews add column if not exists user_name text;
alter table reviews add column if not exists user_avatar text;

update reviews r
set user_name = p.full_name,
    user_avatar = p.avatar_url
from profiles p
where r.user_id = p.id
  and r.user_name is null;

alter table reviews alter column user_name set not null;
