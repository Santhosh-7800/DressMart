-- ============================================================================
-- DressMart — Rewards Program
-- Purely additive: two new tables, no changes to orders/profiles. Points are
-- earned server-side by the app right after an order is created (see
-- rewardsService.earnPointsForOrder) and redeemed at checkout as an extra
-- discount alongside coupons.
-- ============================================================================

create table rewards_wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles (id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  lifetime_points_earned int not null default 0,
  updated_at timestamptz not null default now()
);

create type rewards_transaction_type as enum ('earned', 'redeemed');

create table rewards_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  type rewards_transaction_type not null,
  points int not null,
  description text not null,
  order_id uuid references orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index rewards_transactions_user_idx on rewards_transactions (user_id);

alter table rewards_wallets enable row level security;
alter table rewards_transactions enable row level security;

create policy "owner can read and create their own wallet" on rewards_wallets
  for select using (auth.uid() = user_id);
create policy "owner can insert their own wallet" on rewards_wallets
  for insert with check (auth.uid() = user_id);
create policy "owner can update their own wallet" on rewards_wallets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner can read their own rewards history" on rewards_transactions
  for select using (auth.uid() = user_id);
create policy "owner can insert their own rewards history" on rewards_transactions
  for insert with check (auth.uid() = user_id);

create trigger rewards_wallets_set_updated_at before update on rewards_wallets
  for each row execute procedure set_updated_at();
