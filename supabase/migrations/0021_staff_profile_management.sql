-- ============================================================================
-- DressMart — Staff Portal: self-service profile management.
-- Staff can already edit full_name/phone/avatar_url on `profiles` (owner-update
-- policy from migration 0002) and shop_name/phone/status on `staff` (owner or
-- admin, migration 0019) — this migration only adds the two new preference
-- columns for the Settings page (Theme reuses the existing global theme
-- preference, no column needed) and widens notification_type for the
-- product-approval notification staff can opt into.
-- ============================================================================

alter table staff add column if not exists language text not null default 'en';
alter table staff add column if not exists notifications_enabled boolean not null default true;

alter type notification_type add value if not exists 'product';
