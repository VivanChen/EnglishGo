-- MANUAL CUTOVER, deliberately outside migrations.
-- 1. Apply the additive pet_town_v2_account_api migration.
-- 2. Deploy the new pet-account function and v2 client together. Functions need
--    SUPABASE_URL (or VITE_SUPABASE_URL) and server-only SUPABASE_SERVICE_ROLE_KEY.
-- 3. Verify signup/login/save on a dedicated test account, then run this file.
-- 4. Verify anon/authenticated cannot select/update pet_users or call its RPC.
-- Existing old clients will need to reload; keep this step coordinated with deploy.
-- Nothing here deletes an account, credential, shared wallet or learning record.
begin;
alter table public.pet_users enable row level security;
revoke all on table public.pet_users from public, anon, authenticated;
drop policy if exists "Anyone can insert new pet_users" on public.pet_users;
drop policy if exists "Anyone can read pet_users by username and pin_hash" on public.pet_users;
drop policy if exists "Users can update own data with matching pin_hash" on public.pet_users;
grant select, insert, update on public.pet_users to service_role;
commit;
