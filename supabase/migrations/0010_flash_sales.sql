-- ============================================================================
-- DressMart — Flash Sales
-- Purely additive: new nullable/defaulted columns on the existing products
-- table, so existing rows and existing queries are unaffected.
-- ============================================================================

alter table products add column if not exists is_flash_sale boolean not null default false;
alter table products add column if not exists flash_sale_ends_at timestamptz;
alter table products add column if not exists flash_sale_total_stock int;
alter table products add column if not exists flash_sale_claimed int;

create index if not exists products_flash_sale_idx on products (is_flash_sale, flash_sale_ends_at);
