-- ============================================================================
-- DressMart — Admin authentication bootstrap.
--
-- 1) Seeds the admin@dressmart.com auth user (idempotent — skipped entirely if
--    an account with that email already exists), with the profile trigger
--    below giving it role='admin' the moment its profile row is created.
-- 2) handle_new_user() now force-assigns role='admin' whenever a profile is
--    created for admin@dressmart.com — covers both the seed insert above and
--    the normal /signup form, so "signs up/logs in for the first time" always
--    results in an admin profile regardless of which path created the account.
-- 3) profiles gains an admin-write policy — the existing "owner or admin" SELECT
--    policy already let admins read any profile, but only the OWNER could ever
--    UPDATE one; Staff Management (assigning admin/shop_owner/staff roles to
--    other accounts) needs admin to be able to update someone else's row too.
-- ============================================================================

create extension if not exists pgcrypto;

do $$
declare
  existing_id uuid;
  new_user_id uuid;
begin
  select id into existing_id from auth.users where email = 'admin@dressmart.com';

  if existing_id is null then
    new_user_id := uuid_generate_v4();

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin@dressmart.com', crypt('Admin@123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"DressMart Admin"}'::jsonb,
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      uuid_generate_v4(), new_user_id, new_user_id::text,
      jsonb_build_object('sub', new_user_id::text, 'email', 'admin@dressmart.com'),
      'email', now(), now(), now()
    );
    -- on_auth_user_created fires here, creating the profiles row — the redefined
    -- handle_new_user() below gives it role='admin' since the email matches.
  end if;
end $$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    case when new.email = 'admin@dressmart.com' then 'admin'::user_role else 'customer'::user_role end,
    upper(substr(md5(random()::text || new.id::text), 1, 8)),
    (select id from public.profiles where referral_code = new.raw_user_meta_data ->> 'referred_by_code')
  );
  return new;
end;
$$;

-- Self-heal: if admin@dressmart.com's profile already existed with a non-admin
-- role from before this migration, correct it now rather than only on next signup.
update profiles set role = 'admin' where email = 'admin@dressmart.com' and role <> 'admin';

drop policy if exists "profiles are updatable by admin" on profiles;
create policy "profiles are updatable by admin" on profiles
  for update using (is_admin()) with check (is_admin());
