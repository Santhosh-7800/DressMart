-- ============================================================================
-- DressMart — Product gallery upgrade (360° viewer)
-- Purely additive: one new nullable column on the existing products table, so
-- existing rows and existing queries are unaffected. video_url already exists.
-- ============================================================================

alter table products add column if not exists spin_frames text[];
