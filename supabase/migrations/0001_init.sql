-- ============================================================================
-- DressMart — Initial schema
-- Run via `supabase db push` or paste into the SQL editor of your project.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
create type user_role as enum ('customer', 'admin');
create type gender_type as enum ('men', 'kids');
create type order_status as enum ('placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned');
create type payment_method_type as enum ('upi', 'credit_card', 'debit_card', 'net_banking', 'wallet', 'cod');
create type payment_status_type as enum ('pending', 'paid', 'failed', 'refunded');
create type address_type as enum ('home', 'work', 'other');
create type return_status_type as enum ('none', 'requested', 'approved', 'pickup_scheduled', 'received', 'refunded', 'rejected');
create type notification_type as enum ('order', 'offer', 'system', 'return');
create type discount_type as enum ('percent', 'flat');
create type saved_payment_type as enum ('card', 'upi');

-- ----------------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  avatar_url text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------------------
-- CATALOG: brands, categories, products, variants, images
-- ----------------------------------------------------------------------------
create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  gender gender_type not null,
  parent_id uuid references categories (id) on delete set null,
  image_url text,
  sort_order int not null default 0
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  brand_id uuid not null references brands (id) on delete restrict,
  category_id uuid not null references categories (id) on delete restrict,
  gender gender_type not null,
  description text not null,
  sku text not null unique,
  mrp numeric(10, 2) not null check (mrp >= 0),
  price numeric(10, 2) not null check (price >= 0),
  discount_percent int not null default 0,
  rating numeric(2, 1) not null default 0,
  rating_count int not null default 0,
  total_stock int not null default 0,
  is_active boolean not null default true,
  is_bestseller boolean not null default false,
  is_new_arrival boolean not null default false,
  is_trending boolean not null default false,
  is_deal_of_day boolean not null default false,
  deal_ends_at timestamptz,
  specifications jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  video_url text,
  created_at timestamptz not null default now()
);

create extension if not exists pg_trgm;

create index products_category_idx on products (category_id);
create index products_brand_idx on products (brand_id);
create index products_gender_idx on products (gender);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);

create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products (id) on delete cascade,
  size text not null,
  color text not null,
  color_hex text not null,
  sku text not null unique,
  stock int not null default 0,
  price_override numeric(10, 2),
  unique (product_id, size, color)
);

create index product_variants_product_idx on product_variants (product_id);

create table product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products (id) on delete cascade,
  url text not null,
  alt text not null default '',
  color text,
  sort_order int not null default 0,
  is_video_thumbnail boolean not null default false
);

create index product_images_product_idx on product_images (product_id);

-- ----------------------------------------------------------------------------
-- REVIEWS
-- ----------------------------------------------------------------------------
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text not null,
  comment text not null,
  images text[] not null default '{}',
  is_verified_purchase boolean not null default false,
  helpful_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index reviews_product_idx on reviews (product_id);

-- ----------------------------------------------------------------------------
-- ADDRESSES
-- ----------------------------------------------------------------------------
create table addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  landmark text,
  type address_type not null default 'home',
  is_default boolean not null default false
);

create index addresses_user_idx on addresses (user_id);

-- ----------------------------------------------------------------------------
-- CART & WISHLIST
-- ----------------------------------------------------------------------------
create table cart_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  variant_id uuid not null references product_variants (id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  saved_for_later boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);

create table wishlist_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- COUPONS
-- ----------------------------------------------------------------------------
create table coupons (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  description text not null,
  discount_type discount_type not null,
  discount_value numeric(10, 2) not null,
  min_order_value numeric(10, 2) not null default 0,
  max_discount numeric(10, 2),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_active boolean not null default true,
  usage_limit int,
  used_count int not null default 0
);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,
  user_id uuid not null references profiles (id) on delete cascade,
  status order_status not null default 'placed',
  address_id uuid not null references addresses (id),
  subtotal numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  shipping_fee numeric(10, 2) not null default 0,
  tax numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  coupon_code text,
  payment_method payment_method_type not null,
  payment_status payment_status_type not null default 'pending',
  estimated_delivery timestamptz not null,
  placed_at timestamptz not null default now()
);

create index orders_user_idx on orders (user_id);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  variant_id uuid not null references product_variants (id),
  product_name text not null,
  product_image text not null,
  size text not null,
  color text not null,
  quantity int not null,
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null,
  return_status return_status_type not null default 'none'
);

create index order_items_order_idx on order_items (order_id);

create table order_timeline_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders (id) on delete cascade,
  status order_status not null,
  label text not null,
  note text,
  created_at timestamptz not null default now()
);

create index order_timeline_order_idx on order_timeline_events (order_id);

-- ----------------------------------------------------------------------------
-- RETURNS
-- ----------------------------------------------------------------------------
create table returns (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders (id) on delete cascade,
  order_item_id uuid not null references order_items (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  reason text not null,
  comment text,
  status return_status_type not null default 'requested',
  refund_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index returns_user_idx on returns (user_id);

-- ----------------------------------------------------------------------------
-- SAVED PAYMENT METHODS (tokenized references only — never store raw PAN/CVV)
-- ----------------------------------------------------------------------------
create table saved_payment_methods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  type saved_payment_type not null,
  label text not null,
  last4 text,
  upi_id text,
  is_default boolean not null default false
);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type notification_type not null default 'system',
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id);

-- ----------------------------------------------------------------------------
-- BANNERS (admin-managed home page slider)
-- ----------------------------------------------------------------------------
create table banners (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text,
  image_url text not null,
  link text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on profiles
  for each row execute procedure set_updated_at();
