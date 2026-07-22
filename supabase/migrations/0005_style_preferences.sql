-- ============================================================================
-- DressMart — Style Quiz preferences
-- Stores each user's style quiz answers so personalized recommendations can be
-- regenerated on return visits without retaking the quiz.
-- ============================================================================

create table style_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references profiles (id) on delete cascade,
  favorite_color text not null,
  preferred_fit text not null,
  budget_min numeric(10, 2) not null default 0,
  budget_max numeric(10, 2) not null,
  occasion text not null,
  favorite_brand_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table style_preferences enable row level security;

create policy "owner full access to style preferences" on style_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger style_preferences_set_updated_at before update on style_preferences
  for each row execute procedure set_updated_at();
