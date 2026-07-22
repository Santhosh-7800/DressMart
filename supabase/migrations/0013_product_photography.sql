-- ============================================================================
-- DressMart — Real product photography
-- Purely additive: three new nullable columns on the existing products table
-- (image_url = main image, thumbnail_url = card thumbnail, gallery_images =
-- ordered array of gallery photo URLs). The `product-images` storage bucket
-- and its public-read policy already exist (see 0004_storage.sql) — upload
-- real photos there under <gender>/<category-folder>/<product-slug>-N.webp
-- and populate these columns with the resulting public URLs, or with paths
-- under public/images/products/... if not using Supabase Storage.
-- ============================================================================

alter table products add column if not exists image_url text;
alter table products add column if not exists thumbnail_url text;
alter table products add column if not exists gallery_images text[];
