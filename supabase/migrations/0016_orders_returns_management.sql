-- ============================================================================
-- DressMart — My Orders management upgrade
--
-- 1) order_items gets product_slug/brand_name snapshot columns, the same pattern
--    already used for product_name/product_image — captured at purchase time so
--    "Buy Again" / "Write Review" links and the Brand column in My Orders keep
--    working even if the source product is later renamed, re-categorized, or removed.
-- 2) returns gets a real, appendable `timeline` history (mirrors how order status
--    progression is tracked) so the Returns & Refunds tab shows an honest trail of
--    what's actually happened to a return, not just its current status.
-- Both are purely additive with safe defaults — existing rows are unaffected.
-- ============================================================================

alter table order_items add column if not exists product_slug text not null default '';
alter table order_items add column if not exists brand_name text not null default '';

alter table returns add column if not exists timeline jsonb not null default '[]'::jsonb;
