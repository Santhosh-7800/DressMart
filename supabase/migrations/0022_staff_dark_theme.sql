-- ============================================================================
-- DressMart — Staff Portal dark theme preference, persisted server-side so it
-- survives logging in again on a different device/browser (not just localStorage).
-- ============================================================================

alter table staff add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));
