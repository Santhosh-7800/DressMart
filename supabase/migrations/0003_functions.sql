-- ============================================================================
-- DressMart — helper functions used by the client via supabase.rpc(...)
-- ============================================================================

create or replace function get_product_facets(p_gender gender_type default null)
returns jsonb
language sql
stable
as $$
  with scoped_products as (
    select p.id, p.price, p.brand_id, b.name as brand_name
    from products p
    join brands b on b.id = p.brand_id
    where p.is_active = true
      and (p_gender is null or p.gender = p_gender)
  ),
  scoped_variants as (
    select v.color, v.size
    from product_variants v
    join scoped_products sp on sp.id = v.product_id
  ),
  brand_facets as (
    select jsonb_agg(jsonb_build_object('value', brand_name, 'count', cnt) order by cnt desc)
    from (select brand_name, count(*) as cnt from scoped_products group by brand_name) t
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

-- Atomically decrements variant stock on order placement (called from an edge function / RPC).
create or replace function decrement_variant_stock(p_variant_id uuid, p_quantity int)
returns void
language plpgsql
as $$
begin
  update product_variants
  set stock = greatest(stock - p_quantity, 0)
  where id = p_variant_id;

  update products
  set total_stock = greatest(total_stock - p_quantity, 0)
  where id = (select product_id from product_variants where id = p_variant_id);
end;
$$;
