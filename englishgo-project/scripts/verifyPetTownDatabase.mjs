// Isolated PostgreSQL/WASM verification; no credentials or network database calls.
// Install @electric-sql/pglite outside production deps, then set PGLITE_MODULE to
// its dist/index.js absolute path if it is not otherwise resolvable.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createWorld, applyWorldAction } from '../src/features/pet-town/worldState.js';
import { CHAPTERS } from '../src/features/pet-town/worldData.js';
const { PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const world = createWorld({ now: '2026-10-30T04:00:00Z' });
const hash = 'a'.repeat(64);
const snapshot = (coins = 400, worldState = world) => ({ coins, worldState });
const call = async (action, username, options = {}) => (await db.query(
  'select public.pet_town_account($1,$2,$3,$4,$5,$6,$7::jsonb) as result',
  [action, username, options.hash || hash, options.id || null, options.revision ?? null,
    options.mutation || null, options.snapshot ? JSON.stringify(options.snapshot) : null])).rows[0].result;
let checks = 0;
const checked = () => { checks += 1; };
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.pet_users(
      username text not null, pin_hash text not null, pets jsonb not null default '[]',
      eggs jsonb not null default '[]', inventory jsonb not null default '{}', coins integer not null default 0,
      created_at timestamptz default now(), last_sync timestamptz default now(), primary key(username,pin_hash));
    grant select,insert,update on public.pet_users to anon, authenticated;
    alter table public.pet_users enable row level security;
    create policy "Anyone can insert new pet_users" on public.pet_users for insert to anon,authenticated with check(true);
    create policy "Anyone can read pet_users by username and pin_hash" on public.pet_users for select to anon,authenticated using(true);
    create policy "Users can update own data with matching pin_hash" on public.pet_users for update to anon,authenticated using(true) with check(true);
  `);
  const migration = await readFile(new URL('../supabase/migrations/20261029162431_pet_town_v2_account_api.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // additive migration is safe to reapply in development
  checked();
  await db.query('insert into public.pet_users(username,pin_hash,pets,eggs,inventory,coins) values($1,$2,$3,$4,$5,$6)',
    ['legacy', hash, JSON.stringify([{ petId: 'dragon', level: 10 }]), JSON.stringify([{ id: 'old-egg' }]), JSON.stringify({ apple: 2 }), 99]);
  await db.exec('set role service_role');
  const legacy = await call('login', 'legacy');
  assert.equal(legacy.snapshot.worldState, null); assert.equal(legacy.snapshot.coins, 0);
  assert.ok(legacy.accountId); assert.equal(legacy.revision, 1); checked();
  assert.equal((await call('login', 'legacy', { hash: 'b'.repeat(64) })).code, 'unauthorized'); checked();
  const firstOptions = { id: legacy.accountId, revision: 1, mutation: 'fresh-1', snapshot: snapshot(999) };
  const first = await call('save', 'legacy', firstOptions);
  assert.equal(first.ok, true); assert.equal(first.snapshot.coins, 0); assert.equal(first.revision, 2);
  const retired = (await db.query('select pets,eggs,inventory from public.pet_users where account_id=$1', [legacy.accountId])).rows[0];
  assert.deepEqual(retired, { pets: [], eggs: [], inventory: {} });
  const backup = (await db.query("select to_regclass('pet_town_private.legacy_backups') as name")).rows[0].name;
  assert.equal(backup, null);
  assert.ok(!JSON.stringify(first).includes('dragon')); assert.ok(!JSON.stringify(first).includes(hash)); checked();
  assert.equal((await call('save', 'legacy', firstOptions)).revision, 2); checked();
  assert.equal((await call('save', 'legacy', { ...firstOptions, snapshot: snapshot(2) })).code, 'mutation_conflict'); checked();
  const purchase = await call('save', 'legacy', { id: legacy.accountId, revision: 2, mutation: 'buy-1', snapshot: snapshot(79) });
  assert.equal(purchase.snapshot.coins, 79); assert.equal(purchase.revision, 3); checked();
  const stale = await call('save', 'legacy', { id: legacy.accountId, revision: 2, mutation: 'stale-1', snapshot: snapshot(99) });
  assert.equal(stale.code, 'revision_conflict'); assert.equal(stale.snapshot.coins, 79); checked();
  // A retried earlier mutation returns current state without replaying its old wallet.
  const retry = await call('save', 'legacy', firstOptions);
  assert.equal(retry.revision, 3); assert.equal(retry.snapshot.coins, 79); checked();
  const second = await call('signup', 'new-user', { snapshot: snapshot(42) });
  assert.equal(second.snapshot.coins, 42); assert.notEqual(second.accountId, legacy.accountId);
  assert.equal((await call('signup', 'new-user', { hash: 'b'.repeat(64) })).code, 'account_exists'); checked();
  const chapter = CHAPTERS[0], level = 'elementary';
  let chapterWorld = applyWorldAction(world, { type: 'ADOPT_STARTER', speciesId: 'garden-rabbit' }).world;
  chapter.levels[level].challenges.forEach((challenge, step) => {
    chapterWorld = applyWorldAction(chapterWorld, { type: 'STORY_PROGRESS', chapterId: chapter.id, level, step, answer: challenge.answer }).world;
  });
  chapterWorld = applyWorldAction(chapterWorld, { type: 'COMPLETE_CHAPTER', chapterId: chapter.id, level }).world;
  const chapterSave = await call('save', 'new-user', { id: second.accountId, revision: 0, mutation: 'chapter-1', snapshot: snapshot(42, chapterWorld) });
  assert.equal(chapterSave.ok, true);
  assert.equal(chapterSave.snapshot.worldState.chapterProgress[`${chapter.id}:${level}`].settled, true);
  assert.deepEqual(chapterSave.snapshot.worldState, chapterWorld); checked();
  const wrongAccount = await call('save', 'new-user', { id: legacy.accountId, revision: 3, mutation: 'steal-1', snapshot: snapshot(0) });
  assert.deepEqual(wrongAccount, { ok: false, code: 'unauthorized' }); checked();
  const oldRoster = await call('save', 'legacy', { id: legacy.accountId, revision: 3, mutation: 'old-roster',
    snapshot: snapshot(79, { ...world, ownedPets: [{ speciesId: 'kitty' }] }) });
  assert.equal(oldRoster.code, 'invalid_snapshot'); checked();
  const staleVersion = { ...world }; delete staleVersion.progressVersion;
  assert.equal((await call('save', 'legacy', { id: legacy.accountId, revision: 3,
    mutation: 'old-version', snapshot: snapshot(999, staleVersion) })).code, 'invalid_snapshot'); checked();
  await db.exec('reset role');
  // Additive preparation intentionally leaves the old client's access available.
  assert.equal((await db.query("select has_table_privilege('anon','public.pet_users','select') as allowed")).rows[0].allowed, true);
  const cutover = await readFile(new URL('../supabase/manual/pet-town-v2-cutover.sql', import.meta.url), 'utf8');
  await db.exec(cutover);
  for (const role of ['anon', 'authenticated']) {
    const permissions = (await db.query(`select has_table_privilege($1,'public.pet_users','select') as can_read,
      has_table_privilege($1,'public.pet_users','update') as can_write,
      has_function_privilege($1,'public.pet_town_account(text,text,text,uuid,bigint,text,jsonb)','execute') as can_rpc,
      has_schema_privilege($1,'pet_town_private','usage') as can_archive`, [role])).rows[0];
    assert.deepEqual(permissions, { can_read: false, can_write: false, can_rpc: false, can_archive: false }); checked();
  }
  await db.exec('set role service_role');
  assert.equal((await call('load', 'legacy', { id: legacy.accountId })).snapshot.coins, 79); checked();
  assert.equal((await db.query("select to_regclass('pet_town_private.legacy_backups') as name")).rows[0].name, null); checked();
  await db.exec('reset role');
  await db.query('insert into public.pet_users(username,pin_hash,coins,world_state) values($1,$2,$3,$4)',
    ['old-v2', hash, 500, JSON.stringify({ ...staleVersion, ownedPets:[{id:'old-pet',speciesId:'harbor-cat'}] })]);
  await db.exec('set role service_role');
  assert.equal((await call('login','old-v2',{hash:'b'.repeat(64)})).code,'unauthorized');
  assert.equal((await db.query('select coins from public.pet_users where username=$1',['old-v2'])).rows[0].coins,500);
  const resetV2=await call('login','old-v2');
  assert.equal(resetV2.snapshot.worldState,null); assert.equal(resetV2.snapshot.coins,0);
  assert.equal((await call('load','old-v2',{id:resetV2.accountId})).revision,resetV2.revision); checked();
  console.log(JSON.stringify({ ok: true, checks, database: 'isolated PostgreSQL via PGlite', productionTouched: false }));
} finally { await db.close(); }
