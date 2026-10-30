import { createWorld, migrateLegacyWorld, applyWorldAction } from './worldState.js';

export const TOWN_PREFIX = 'eg_pet_world_v2:';
export const townScope = account => account?.accountId ? `account:${account.accountId}` : account?.username ? `legacy:${encodeURIComponent(account.username)}:${account.pinHash || ''}` : 'guest';
export function readJSON(key, fallback = null) {
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; }
}
export function readTownSnapshot(account, coins = 0) {
  const scope = townScope(account), stored = readJSON(TOWN_PREFIX + scope);
  if (stored?.worldState?.schemaVersion === 2) return { ...stored, worldState: normalizeTownWorld(stored.worldState), pending: validPending(stored.pending) };
  return { worldState: createWorld(), coins, revision: 0, pending: [], migrated: false };
}
const validPending = entries => (Array.isArray(entries) ? entries : []).filter(entry => entry && typeof entry.id === 'string' && entry.action && typeof entry.action.type === 'string');
export function normalizeTownWorld(raw) {
  // Preserve transport receipts across domain normalization and reconnects.
  return { ...migrateLegacyWorld(raw), syncReceipts: [...new Set((Array.isArray(raw?.syncReceipts) ? raw.syncReceipts : []).filter(id => typeof id === 'string' && id.length <= 200))].slice(-1500) };
}
export function saveTownSnapshot(account, snapshot) {
  try { localStorage.setItem(TOWN_PREFIX + townScope(account), JSON.stringify(snapshot)); return true; } catch { return false; }
}
export const operationId = () => globalThis.crypto?.randomUUID?.() || `town-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function commitTownOperation(snapshot, action, coins = snapshot.coins, now = new Date().toISOString()) {
  const id = action.operationId || operationId();
  if (snapshot.worldState.syncReceipts?.includes(id)) return { snapshot, notice: '' };
  if (action.type === 'WALLET_DELTA') {
    if (!Number.isFinite(action.delta) || action.delta === 0) return { snapshot, notice: '' };
    const worldState = { ...snapshot.worldState, syncReceipts: [...(snapshot.worldState.syncReceipts || []), id].slice(-1500) };
    return { snapshot: { ...snapshot, worldState, coins: Math.max(0, coins + action.delta), pending: [...snapshot.pending, { id, action: { ...action, operationId: id }, at: now }] } };
  }
  const result = applyWorldAction(snapshot.worldState, action, { coins, now });
  const learningWallet = action.type === 'LEARNING_EVENT' && Number.isFinite(action.walletDelta) ? Math.max(0, action.walletDelta) : 0;
  // Keep each chapter's first wallet reward in the same replayable operation as
  // its completion receipt. A second device cannot retain a detached +5 delta.
  const chapterWallet = result.completedChapter ? 5 : 0;
  if (result.world === snapshot.worldState && !learningWallet) return { snapshot, ...result };
  const worldState = { ...result.world, syncReceipts: [...(result.world.syncReceipts || []), id].slice(-1500) };
  return { ...result, snapshot: { ...snapshot, worldState, coins: Math.max(0, coins + (result.coinDelta || 0) + learningWallet + chapterWallet), pending: [...snapshot.pending, { id, action: { ...action, operationId: id }, at: now }] } };
}
export function rebaseTownOperations(remote, pending) {
  let next = { worldState: normalizeTownWorld(remote.worldState || createWorld()), coins: remote.coins || 0, revision: remote.revision || 0, pending: [] };
  for (const entry of validPending(pending)) {
    if (next.worldState.syncReceipts?.includes(entry.id)) continue;
    next = commitTownOperation(next, { ...entry.action, operationId: entry.id }, next.coins, entry.at).snapshot;
  }
  return next;
}
export function prepareTownSave(snapshot) {
  if (snapshot.inFlight) return snapshot;
  const migrating = !!snapshot.migrationBase;
  return { ...snapshot, inFlight: { mutationId: operationId(), baseRevision: snapshot.revision,
    snapshot: migrating ? snapshot.migrationBase : { worldState: snapshot.worldState, coins: snapshot.coins },
    operationIds: migrating ? [] : snapshot.pending.map(entry => entry.id) } };
}
export function acknowledgeTownSave(local, response) {
  const sentIds = new Set(local.inFlight?.operationIds || []);
  return rebaseTownOperations({ ...response.snapshot, revision: response.revision }, local.pending.filter(entry => !sentIds.has(entry.id)));
}

// Existing learning modules retain their own completion checks. This bridge only
// records participation, never claims that XP is proof of language mastery.
export function recordTownLearning(event, account, coins) {
  if (!event?.id) return false;
  const explicitDelta = Number.isFinite(event.coinDelta) ? Math.max(0, event.coinDelta) : null;
  // coins is the post-award total; the explicit delta also handles React batches.
  const snapshot = readTownSnapshot(account, Math.max(0, coins - (explicitDelta || 0)));
  const walletDelta = explicitDelta ?? Math.max(0, coins - snapshot.coins);
  const next = commitTownOperation(snapshot, { type: 'LEARNING_EVENT', event, walletDelta, operationId: event.id }, snapshot.coins, event.completedAt || new Date().toISOString()).snapshot;
  if (next === snapshot) return true;
  const saved = saveTownSnapshot(account, next);
  window.dispatchEvent(new CustomEvent('englishgo:town-learning', { detail: { scope: townScope(account), snapshot: next, saved } }));
  return saved;
}
