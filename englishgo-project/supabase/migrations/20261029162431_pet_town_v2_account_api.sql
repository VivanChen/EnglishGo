-- Prepare the versioned API; existing progress resets on first verified access.
-- This migration does NOT close the old public API.
-- Deploy pet-account + the v2 client, then run manual/pet-town-v2-cutover.sql.
-- Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
begin;

alter table public.pet_users
  add column if not exists account_id uuid not null default gen_random_uuid(),
  add column if not exists world_state jsonb not null default '{}'::jsonb,
  add column if not exists save_revision bigint not null default 0;
create unique index if not exists pet_users_account_id_key on public.pet_users(account_id);

create schema if not exists pet_town_private;
revoke all on schema pet_town_private from public, anon, authenticated;
grant usage on schema pet_town_private to service_role;

create table if not exists pet_town_private.save_receipts (
  account_id uuid not null references public.pet_users(account_id),
  mutation_id text not null,
  payload_hash text not null,
  saved_revision bigint not null,
  saved_at timestamptz not null default now(),
  primary key (account_id, mutation_id)
);
alter table pet_town_private.save_receipts enable row level security;
revoke all on all tables in schema pet_town_private from public, anon, authenticated;
grant select, insert, update on all tables in schema pet_town_private to service_role;
grant delete on pet_town_private.save_receipts to service_role;
grant select, insert, update on public.pet_users to service_role;

-- SECURITY INVOKER: only the server service role can execute/access these objects.
-- A row lock makes the one-time fresh start, coins and revision one transaction.
create or replace function public.pet_town_account(
  p_action text, p_username text, p_pin_hash text,
  p_account_id uuid default null, p_base_revision bigint default null,
  p_mutation_id text default null, p_snapshot jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.pet_users%rowtype;
  receipt pet_town_private.save_receipts%rowtype;
  result jsonb;
  request_hash text;
  new_coins integer;
  incoming_world jsonb;
begin
  if current_user not in ('service_role', 'postgres') then
    raise insufficient_privilege;
  end if;
  if p_action not in ('signup', 'login', 'load', 'save')
    or p_username is null or length(p_username) not between 2 and 20
    or p_pin_hash is null or p_pin_hash !~ '^([a-fA-F0-9]{64}|-?[0-9]{1,11})$' then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if p_action = 'save' or (p_action = 'signup' and p_snapshot is not null) then
    incoming_world := p_snapshot->'worldState';
    if p_snapshot is null or jsonb_typeof(p_snapshot) is distinct from 'object'
      or jsonb_typeof(incoming_world) is distinct from 'object'
      or incoming_world->>'schemaVersion' is distinct from '2'
      or incoming_world->>'progressVersion' is distinct from 'seabreeze-20261030'
      or jsonb_typeof(incoming_world->'ownedPets') is distinct from 'array'
      or octet_length(p_snapshot::text) > 262144
      or jsonb_typeof(p_snapshot->'coins') is distinct from 'number'
      or (p_snapshot->>'coins') !~ '^[0-9]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_snapshot');
    end if;
    if (p_snapshot->>'coins')::numeric > 2147483647
      or jsonb_array_length(incoming_world->'ownedPets') > 3
      or incoming_world ?| array['pets','eggs','inventory','gacha','skills']
      or exists(select 1 from jsonb_array_elements(incoming_world->'ownedPets') pet
        where pet->>'speciesId' is null or pet->>'speciesId' not in ('harbor-cat','sunny-dog','garden-rabbit')) then
      return jsonb_build_object('ok', false, 'code', 'invalid_snapshot');
    end if;
    new_coins := (p_snapshot->>'coins')::integer;
  end if;

  if p_action = 'signup' then
    if p_pin_hash !~ '^[a-fA-F0-9]{64}$' then
      return jsonb_build_object('ok', false, 'code', 'unauthorized');
    end if;
    -- The legacy PK is (username,pin_hash); serialize new signups by username.
    perform pg_advisory_xact_lock(hashtextextended(p_username, 0));
    if exists(select 1 from public.pet_users where username = p_username) then
      return jsonb_build_object('ok', false, 'code', 'account_exists');
    end if;
    insert into public.pet_users(username, pin_hash, pets, eggs, inventory, coins, world_state, last_sync)
    values (p_username, p_pin_hash, '[]', '[]', '{}', coalesce(new_coins, 0),
      coalesce(incoming_world, '{"progressVersion":"seabreeze-20261030"}'::jsonb), now())
    returning * into account;
  else
    select * into account from public.pet_users
    where username = p_username and pin_hash = p_pin_hash for update;
    if not found or (p_account_id is not null and account.account_id <> p_account_id) then
      return jsonb_build_object('ok', false, 'code', 'unauthorized');
    end if;
  end if;

  -- Existing accounts start this release with no old pet roster or wallet.
  -- Persist the marker even before a first world save, so repeated loads do not
  -- reset new play. Old payloads are rejected by the progressVersion check above.
  if account.world_state->>'progressVersion' is distinct from 'seabreeze-20261030' then
    update public.pet_users set pets = '[]'::jsonb, eggs = '[]'::jsonb,
      inventory = '{}'::jsonb, coins = 0,
      world_state = '{"progressVersion":"seabreeze-20261030"}'::jsonb,
      save_revision = save_revision + 1, last_sync = now()
    where account_id = account.account_id returning * into account;
    delete from pet_town_private.save_receipts where account_id = account.account_id;
  end if;

  result := jsonb_build_object('ok', true, 'accountId', account.account_id,
    'revision', account.save_revision, 'syncedAt', account.last_sync,
    'snapshot', jsonb_build_object('worldState', case when account.world_state->>'schemaVersion' = '2' then account.world_state else 'null'::jsonb end,
      'coins', account.coins));
  if p_action <> 'save' then return result; end if;
  if p_account_id is null or p_base_revision is null or p_base_revision < 0
    or p_mutation_id is null or length(p_mutation_id) not between 1 and 120
    or p_mutation_id !~ '^[a-zA-Z0-9:_.-]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_snapshot');
  end if;

  request_hash := encode(sha256(convert_to(p_snapshot::text, 'UTF8')), 'hex');
  select * into receipt from pet_town_private.save_receipts
    where account_id = account.account_id and mutation_id = p_mutation_id;
  if found then
    if receipt.payload_hash = request_hash then return result; end if;
    return result || jsonb_build_object('ok', false, 'code', 'mutation_conflict');
  end if;
  if account.save_revision <> p_base_revision then
    return result || jsonb_build_object('ok', false, 'code', 'revision_conflict');
  end if;

  -- An old local wallet cannot seed the first world in the fresh release.
  if account.world_state->>'schemaVersion' is distinct from '2' then new_coins := 0; end if;

  update public.pet_users set world_state = incoming_world, coins = new_coins,
    pets = '[]'::jsonb, eggs = '[]'::jsonb, inventory = '{}'::jsonb,
    save_revision = save_revision + 1, last_sync = now()
  where account_id = account.account_id returning * into account;
  insert into pet_town_private.save_receipts(account_id, mutation_id, payload_hash, saved_revision)
    values (account.account_id, p_mutation_id, request_hash, account.save_revision);
  return jsonb_build_object('ok', true, 'accountId', account.account_id,
    'revision', account.save_revision, 'syncedAt', account.last_sync,
    'snapshot', jsonb_build_object('worldState', account.world_state, 'coins', account.coins));
end;
$$;

revoke all on function public.pet_town_account(text,text,text,uuid,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.pet_town_account(text,text,text,uuid,bigint,text,jsonb) to service_role;
commit;
