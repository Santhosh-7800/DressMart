-- ============================================================================
-- DressMart — Referral Program
-- Adds a unique referral_code to every profile (generated at signup) plus an
-- optional referred_by link, and a new referrals table tracking each person a
-- user has referred through to their first order (see referralService).
-- ============================================================================

alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references profiles (id) on delete set null;

-- Backfill existing rows with a code so the unique constraint (and the app,
-- which assumes every profile has one) both hold for pre-existing accounts.
update profiles set referral_code = upper(substr(md5(random()::text || id::text), 1, 8)) where referral_code is null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    upper(substr(md5(random()::text || new.id::text), 1, 8)),
    (select id from public.profiles where referral_code = new.raw_user_meta_data ->> 'referred_by_code')
  );
  return new;
end;
$$;

create type referral_status as enum ('pending', 'completed', 'rewarded');

create table referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  referred_user_id uuid not null references profiles (id) on delete cascade,
  referred_name text not null,
  referred_email text not null,
  status referral_status not null default 'pending',
  reward_coupon_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (referred_user_id)
);

create index referrals_referrer_idx on referrals (referrer_id);

alter table referrals enable row level security;

create policy "owner can read referrals they made" on referrals
  for select using (auth.uid() = referrer_id);
create policy "referrer can record a new referral" on referrals
  for insert with check (auth.uid() = referrer_id or auth.uid() = referred_user_id);
create policy "owner can update referrals they made" on referrals
  for update using (auth.uid() = referrer_id) with check (auth.uid() = referrer_id);

-- Reward coupons are minted into the existing shared catalog, scoped to one user.
alter table coupons add column if not exists granted_to_user_id uuid references profiles (id) on delete cascade;
