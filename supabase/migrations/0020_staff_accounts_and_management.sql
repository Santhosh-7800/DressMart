-- ============================================================================
-- DressMart — Seed 3 named staff accounts + extend the Staff Portal/Admin
-- Staff Management with employee_id/department, draft products, account
-- activate/deactivate, and richer product provenance tracking.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- staff: employee_id/department, alongside the existing shop_name/status.
-- ----------------------------------------------------------------------------
alter table staff add column if not exists employee_id text;
alter table staff add column if not exists department text;

-- ----------------------------------------------------------------------------
-- products: fuller staff-submission provenance, and a new 'draft' approval
-- state (a staff product that hasn't been submitted for review yet — never
-- shown in Admin's review queue, freely re-editable, never customer-visible).
-- ----------------------------------------------------------------------------
alter table products add column if not exists created_by_name text;
alter table products add column if not exists employee_id text;
alter table products add column if not exists department text;

alter table products drop constraint if exists products_approval_status_check;
alter table products add constraint products_approval_status_check
  check (approval_status in ('draft', 'pending', 'approved', 'rejected'));

-- ----------------------------------------------------------------------------
-- Seed the 3 named staff accounts (idempotent — skipped per-account if that
-- email already exists). Mirrors migration 0018's admin-seed pattern: insert
-- directly into auth.users/auth.identities so handle_new_user() creates the
-- matching profiles row, then upsert the staff table row on top of it.
-- ----------------------------------------------------------------------------
do $$
declare
  seed record;
  existing_id uuid;
  new_user_id uuid;
begin
  for seed in
    select * from (values
      ('staff1@dressmart.com', 'Staff@123', 'Rahul Kumar', 'DM-STF-001', '9876543210', 'DressMart Main Store', E'Men\'s Wear'),
      ('staff2@dressmart.com', 'Staff@123', 'Priya Sharma', 'DM-STF-002', '9876543211', 'DressMart Main Store', 'Kids Wear'),
      ('staff3@dressmart.com', 'Staff@123', 'Arjun Reddy', 'DM-STF-003', '9876543212', 'DressMart Main Store', 'Formal Wear')
    ) as s(email, password, full_name, employee_id, phone, shop_name, department)
  loop
    select id into existing_id from auth.users where email = seed.email;

    if existing_id is null then
      new_user_id := uuid_generate_v4();

      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        seed.email, crypt(seed.password, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', seed.full_name, 'phone', seed.phone),
        '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        uuid_generate_v4(), new_user_id, new_user_id::text,
        jsonb_build_object('sub', new_user_id::text, 'email', seed.email),
        'email', now(), now(), now()
      );
      -- on_auth_user_created fires here, creating the profiles row with role='customer'
      -- (handle_new_user() only special-cases admin@dressmart.com) — force it to 'staff' below.

      existing_id := new_user_id;
    end if;

    update profiles set role = 'staff' where id = existing_id and role <> 'staff';

    insert into staff (id, name, email, phone, shop_name, department, employee_id, role, status)
    values (existing_id, seed.full_name, seed.email, seed.phone, seed.shop_name, seed.department, seed.employee_id, 'staff', 'active')
    on conflict (id) do update set
      name = excluded.name,
      phone = excluded.phone,
      shop_name = excluded.shop_name,
      department = excluded.department,
      employee_id = excluded.employee_id;
  end loop;
end $$;
