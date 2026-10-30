// Credentials are verified by a service-role-only transactional database function.
// This endpoint never returns a credential.
import { PROGRESS_VERSION } from '../../src/data/progressReset.js';
const MAX_BODY_BYTES = 256 * 1024;
const SPECIES = new Set(['harbor-cat', 'sunny-dog', 'garden-rabbit']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(['signup', 'login', 'load', 'save']);

export const config = {
  rateLimit: { action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 60 },
};

const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 100) => typeof value === 'string' && value.length > 0 && value.length <= max;
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const strings = (value, maximum, length = 120) => Array.isArray(value) && value.length <= maximum && value.every(item => text(item, length));

function boundedJson(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= 2048;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  if (Array.isArray(value)) return value.length <= 10000 && value.every(item => boundedJson(item, depth + 1));
  return object(value) && Object.keys(value).length <= 10000 && Object.entries(value).every(([key, item]) =>
    key.length <= 200 && !['__proto__', 'constructor', 'prototype', 'pinHash', 'pin_hash', 'legacyBackup'].includes(key)
    && boundedJson(item, depth + 1));
}

export function validWorldState(world) {
  if (!object(world) || world.schemaVersion !== 2 || world.progressVersion !== PROGRESS_VERSION || !boundedJson(world)) return false;
  // Never accept the retired roster or egg inventory through an extra field.
  if (['pets', 'eggs', 'inventory', 'gacha', 'skills'].some(key => key in world)) return false;
  if (!Array.isArray(world.ownedPets) || world.ownedPets.length > 3) return false;
  if (!world.ownedPets.every(pet => object(pet) && text(pet.id, 100) && SPECIES.has(pet.speciesId)
    && text(pet.name, 40) && number(pet.exp, 0, 1e9) && number(pet.bond, 0, 1e9)
    && ['hunger', 'clean', 'energy'].every(key => number(pet[key], 0, 100)))) return false;
  if (new Set(world.ownedPets.map(pet => pet.id)).size !== world.ownedPets.length
    || new Set(world.ownedPets.map(pet => pet.speciesId)).size !== world.ownedPets.length) return false;
  if (world.activePetId !== null && !world.ownedPets.some(pet => pet.id === world.activePetId)) return false;
  if (world.starterChosen !== undefined && typeof world.starterChosen !== 'boolean' || !strings(world.ownedDecorations, 500)
    || !strings(world.completedChapters, 500) || !strings(world.receipts, 10000, 200)) return false;
  if (!Array.isArray(world.placements) || world.placements.length > 300 || !world.placements.every(item =>
    object(item) && text(item.id, 100) && text(item.itemId, 100)
    && number(item.x, -1000, 1000) && number(item.z, -1000, 1000) && number(item.rotation, -100000, 100000))) return false;
  if (!object(world.chapterProgress) || !Object.values(world.chapterProgress).every(progress => object(progress)
    && Number.isSafeInteger(progress.step) && progress.step >= 0 && progress.step <= 1000000
    && object(progress.answers) && object(progress.attempts)
    && (progress.settled === undefined || typeof progress.settled === 'boolean')
    && Object.values(progress.answers).every(value => Number.isSafeInteger(value) && value >= 0 && value < 20)
    && Object.values(progress.attempts).every(value => Number.isSafeInteger(value) && value >= 0 && value <= 99))) return false;
  if (!Array.isArray(world.journal) || world.journal.length > 1000 || !object(world.settings)
    || !['auto', 'high', 'low'].includes(world.settings.quality)
    || typeof world.settings.motion !== 'boolean' || typeof world.settings.sound !== 'boolean') return false;
  return true;
}

function validSnapshot(snapshot) {
  return object(snapshot) && validWorldState(snapshot.worldState)
    && Number.isSafeInteger(snapshot.coins) && snapshot.coins >= 0 && snapshot.coins <= 2147483647;
}

function getEnv(name) {
  try { const value = globalThis.Netlify?.env?.get?.(name); if (value) return value; } catch {}
  return process.env[name] || '';
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}
const failure = (status, code) => json(status, { ok: false, code });

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new Error('body_too_large');
  if (!request.body) throw new Error('invalid_request');
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { void reader.cancel().catch(() => {}); throw new Error('body_too_large'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
}

export default async function petAccount(request) {
  if (request.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' }, { Allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return failure(403, 'forbidden_origin');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return failure(415, 'invalid_content_type');
  let body;
  try { body = await readBody(request); }
  catch (error) { return failure(error.message === 'body_too_large' ? 413 : 400, error.message === 'body_too_large' ? 'body_too_large' : 'invalid_request'); }
  if (!object(body) || !ACTIONS.has(body.action) || !object(body.credentials)) return failure(400, 'invalid_request');
  const username = typeof body.credentials.username === 'string' ? body.credentials.username.trim() : '';
  const pinHash = body.credentials.pinHash;
  if (username.length < 2 || username.length > 20 || /[\u0000-\u001f\u007f]/.test(username)
    || typeof pinHash !== 'string' || !(/^[a-f0-9]{64}$/i.test(pinHash)
      || body.action !== 'signup' && /^-?\d{1,11}$/.test(pinHash))) return failure(400, 'invalid_credentials');
  const save = body.save;
  if (body.action === 'save' && (!object(save) || !UUID.test(save.accountId)
    || !Number.isSafeInteger(save.baseRevision) || save.baseRevision < 0
    || !text(save.mutationId, 120) || !/^[a-zA-Z0-9:_.-]+$/.test(save.mutationId)
    || !validSnapshot(save.snapshot))) return failure(400, 'invalid_snapshot');
  if (body.action === 'signup' && body.snapshot !== undefined && !validSnapshot(body.snapshot)) return failure(400, 'invalid_snapshot');
  if (body.action === 'load' && body.accountId !== undefined && !UUID.test(body.accountId)) return failure(400, 'invalid_request');
  const baseUrl = (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')).replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) return failure(503, 'cloud_unavailable');
  try {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/pet_town_account`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        p_action: body.action, p_username: username, p_pin_hash: pinHash,
        p_account_id: body.action === 'save' ? save.accountId : body.accountId || null,
        p_base_revision: body.action === 'save' ? save.baseRevision : null,
        p_mutation_id: body.action === 'save' ? save.mutationId : null,
        p_snapshot: body.action === 'save' ? save.snapshot : body.action === 'signup' ? body.snapshot || null : null,
      }),
    });
    if (!response.ok) return failure(503, 'cloud_unavailable');
    const result = await response.json();
    const status = result?.ok ? 200 : ({ unauthorized: 401, account_exists: 409, revision_conflict: 409, mutation_conflict: 409, invalid_snapshot: 400 })[result?.code];
    if (!status) return failure(503, 'cloud_unavailable');
    // A deployment without the fresh-start SQL must never restore old progress.
    if (result.snapshot && (result.snapshot.worldState
      ? result.snapshot.worldState.progressVersion !== PROGRESS_VERSION
      : result.snapshot.coins !== 0)) return failure(503, 'cloud_unavailable');
    // Explicit projection is intentional: even a future SQL change cannot leak credentials/backups.
    const output = { ok: result.ok === true };
    if (!output.ok) output.code = result.code;
    if (result.accountId && result.snapshot) {
      output.accountId = result.accountId;
      output.revision = result.revision;
      output.snapshot = { worldState: result.snapshot.worldState ?? null, coins: result.snapshot.coins };
      output.syncedAt = result.syncedAt;
    }
    return json(status, output);
  } catch { return failure(503, 'cloud_unavailable'); }
}
