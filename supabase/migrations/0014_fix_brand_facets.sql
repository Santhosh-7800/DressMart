-- ============================================================================
-- DressMart — fix get_product_facets() brand facet id/name mismatch, and scope
-- facet counts by the active category (not just gender).
--
-- 1) get_product_facets() previously emitted the brand facet as
--    {"value": brand_name, "count": ...}, but every filter path (ProductFilters.tsx
--    -> filters.brandIds -> productService.list()'s `.in('brand_id', filters.brandIds)`)
--    expects `value` to be the brand's id, not its display name. Selecting any
--    brand therefore always excluded every product. Now the facet's `value` is
--    the actual brand_id (the field products are filtered on), with the display
--    name carried separately as `label` — mirroring the equivalent fix in
--    src/services/mock/mockCatalogQueries.ts's getFacets().
--
-- 2) Facet counts were also scoped by gender only, so e.g. a brand's sidebar
--    count reflected that brand across every category, while a category page
--    only ever shows that category's products — the two numbers could never
--    match. Added an optional p_category_slug so counts reflect exactly what
--    a category listing page renders.
-- ============================================================================

create or replace function get_product_facets(p_gender gender_type default null, p_category_slug text default null)
returns jsonb
language sql
stable
as $$
  with scoped_products as (
    select p.id, p.price, p.brand_id, b.name as brand_name
    from products p
    join brands b on b.id = p.brand_id
    join categories c on c.id = p.category_id
    where p.is_active = true
      and (p_gender is null or p.gender = p_gender)
      and (p_category_slug is null or c.slug = p_category_slug)
  ),
  scoped_variants as (
    select v.color, v.size
    from product_variants v
    join scoped_products sp on sp.id = v.product_id
  ),
  brand_facets as (
    select jsonb_agg(jsonb_build_object('value', brand_id, 'label', brand_name, 'count', cnt) order by cnt desc)
    from (select brand_id, brand_name, count(*) as cnt from scoped_products group by brand_id, brand_name) t
  ),
  color_facets as (
    select jsonb_agg(jsonb_build_object('value', color, 'count', cnt) order by cnt desc)
    from (select color, count(*) as cnt from scoped_variants group by color) t
  ),
  size_facets as (
    select jsonb_agg(jsonb_build_object('value', size, 'count', cnt) order by cnt desc)
    from (select size, count(*) as cnt from scoped_variants group by size) t
  ),
  price_range as (
    select min(price) as min_price, max(price) as max_price from scoped_products
  )
  select jsonb_build_object(
    'brands', coalesce((select * from brand_facets), '[]'::jsonb),
    'colors', coalesce((select * from color_facets), '[]'::jsonb),
    'sizes', coalesce((select * from size_facets), '[]'::jsonb),
    'priceRange', jsonb_build_object(
      'min', coalesce((select min_price from price_range), 0),
      'max', coalesce((select max_price from price_range), 0)
    )
  );
$$;
