-- ============================================================================
-- DressMart — Order Tracking upgrade
-- Purely additive: new nullable columns on the existing orders table, so
-- existing rows and existing queries are unaffected.
-- ============================================================================

alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists courier_name text;
alter table orders add column if not exists courier_phone text;
