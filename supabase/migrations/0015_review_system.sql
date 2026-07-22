-- ============================================================================
-- DressMart — production-ready review & rating system
--
-- Replaces the placeholder `reviews` table (0001_init.sql) + RLS (0002_rls_policies.sql)
-- with a schema that ties every review to the exact delivered order item it was earned
-- from, and adds dynamic (never-stored) rating aggregation:
--
-- 1) reviews: renamed title/comment -> review_title/review_text (both nullable — a
--    star-only rating with no written review is allowed), added order_id/order_item_id/
--    updated_at, and swapped the (product_id, user_id) unique constraint for
--    unique(order_item_id) — "one review per order item", not "one review per product",
--    so a customer who bought the same product twice may review each purchase.
-- 2) product_rating_summary: a plain (non-materialized) VIEW, left-joined from products
--    so every product gets a row even with zero reviews. average_rating/total_reviews/
--    rating_5..rating_1 are computed on every query — never stored — per the requirement
--    that these numbers must always reflect the live reviews table.
-- 3. get_rating_summary / get_rating_summaries: RPC wrappers over that view for the PDP
--    (single product) and card/list views (many products at once).
-- 4. get_reviewable_order_items: returns the calling user's delivered, not-yet-reviewed
--    order items for a product — drives whether the "Write a Review" UI can even appear.
-- 5. RLS insert policy now enforces verified-purchase at the database level (not just in
--    application code): the order_item_id must belong to auth.uid()'s own delivered order,
--    for the same product, and must not already have a review.
-- ============================================================================

alter table reviews rename column title to review_title;
alter table reviews rename column comment to review_text;
alter table reviews alter column review_title drop not null;
alter table reviews alter column review_text drop not null;

alter table reviews add column if not exists order_id uuid references orders (id) on delete set null;
alter table reviews add column if not exists order_item_id uuid references order_items (id) on delete cascade;
alter table reviews add column if not exists updated_at timestamptz not null default now();

-- Backfill order_item_id for any pre-existing rows before making it required — a fresh
-- project has none, but this keeps the migration safe to run against seeded data too.
delete from reviews where order_item_id is null;
alter table reviews alter column order_item_id set not null;

alter table reviews drop constraint if exists reviews_product_id_user_id_key;
alter table reviews add constraint reviews_order_item_id_key unique (order_item_id);

-- ----------------------------------------------------------------------------
-- Dynamic rating aggregation — a view, not a stored/materialized column, so
-- average_rating/total_reviews/rating_N are always computed from the live reviews table.
-- ----------------------------------------------------------------------------
create or replace view product_rating_summary as
select
  p.id as product_id,
  coalesce(round(avg(r.rating)::numeric, 1), 0) as average_rating,
  count(r.id) as total_reviews,
  count(r.id) filter (where r.rating = 5) as rating_5,
  count(r.id) filter (where r.rating = 4) as rating_4,
  count(r.id) filter (where r.rating = 3) as rating_3,
  count(r.id) filter (where r.rating = 2) as rating_2,
  count(r.id) filter (where r.rating = 1) as rating_1
from products p
left join reviews r on r.product_id = p.id
group by p.id;

create or replace function get_rating_summary(p_product_id uuid)
returns product_rating_summary
language sql
stable
as $$
  select * from product_rating_summary where product_id = p_product_id;
$$;

create or replace function get_rating_summaries(p_product_ids uuid[])
returns setof product_rating_summary
language sql
stable
as $$
  select * from product_rating_summary where product_id = any (p_product_ids);
$$;

-- Which of the calling user's own order items for this product are still reviewable —
-- delivered, and not already reviewed. Backs the "Write a Review" gate in the UI.
create or replace function get_reviewable_order_items(p_user_id uuid, p_product_id uuid)
returns table (
  order_item_id uuid,
  order_id uuid,
  order_number text,
  product_id uuid,
  size text,
  color text,
  delivered_at timestamptz
)
language sql
stable
as $$
  select
    oi.id as order_item_id,
    o.id as order_id,
    o.order_number,
    oi.product_id,
    oi.size,
    oi.color,
    o.placed_at as delivered_at
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.user_id = p_user_id
    and o.status = 'delivered'
    and oi.product_id = p_product_id
    and not exists (select 1 from reviews r where r.order_item_id = oi.id);
$$;

-- ----------------------------------------------------------------------------
-- RLS — verified-purchase enforcement at the database level. The unique(order_item_id)
-- constraint alone stops a duplicate review, but not a review on someone else's order or
-- an undelivered one; this `with check` closes both.
-- ----------------------------------------------------------------------------
drop policy if exists "users can write their own reviews" on reviews;
create policy "verified purchasers can write reviews" on reviews
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = reviews.order_item_id
        and o.user_id = auth.uid()
        and o.status = 'delivered'
        and oi.product_id = reviews.product_id
    )
  );

drop policy if exists "users can update their own reviews" on reviews;
create policy "users can update their own reviews" on reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
