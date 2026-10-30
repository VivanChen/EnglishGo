import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorld } from './worldState.js';
import { requestPetAccount } from './cloudAccount.js';
import { acknowledgeTownSave, commitTownOperation, normalizeTownWorld, prepareTownSave,
  readTownSnapshot, rebaseTownOperations, saveTownSnapshot, townScope } from './townStorage.js';

const identity = account => account?.username ? `${account.username}\0${account.pinHash}` : 'guest';
const pendingStatus = (account, snapshot) => !account?.username ? 'local'
  : snapshot.pending.length || snapshot.needsInitialSave || snapshot.inFlight ? 'pending' : 'synced';

export default function useTownWorld({ coins, setCoins, account, setAccount, onChapterComplete }) {
  const [snapshot, setSnapshot] = useState(() => {
    const saved = readTownSnapshot(account, coins);
    return coins === saved.coins ? saved : commitTownOperation(saved, { type: 'WALLET_DELTA', delta: coins - saved.coins }).snapshot;
  });
  const [status, setStatus] = useState(account?.username ? 'loading' : 'local');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const current = useRef(snapshot), wallet = useRef(coins);
  const expectedWallet = useRef(null);
  const callbacks = useRef({ setCoins, setAccount, onChapterComplete });
  callbacks.current = { setCoins, setAccount, onChapterComplete };
  const activeAccount = useRef(account), activeIdentity = useRef(identity(account));
  const generation = useRef(0), mounted = useRef(true), ready = useRef(!account?.username);
  const request = useRef(null), stopped = useRef(false);

  const persist = useCallback(next => {
    current.current = next; setSnapshot(next);
    const saved = saveTownSnapshot(activeAccount.current, next);
    if (!saved) { stopped.current = true; setStatus('error'); setNotice('裝置空間不足，這次變更還沒存好。請保留此頁並釋放空間後重試。'); }
    return saved;
  }, []);
  const updateWallet = useCallback(value => {
    if (wallet.current !== value) { wallet.current = value; expectedWallet.current = value; callbacks.current.setCoins(value); }
  }, []);
  const cancelRequest = useCallback(() => {
    generation.current++; request.current?.abort(); request.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!saveTownSnapshot(activeAccount.current, current.current)) {
      stopped.current = true; setStatus('error'); setNotice('本機存檔暫時無法寫入，請保留此頁並釋放裝置空間。');
    }
    return () => { mounted.current = false; cancelRequest(); };
  }, [cancelRequest]);

  useEffect(() => {
    if (identity(account) === activeIdentity.current) { activeAccount.current = account; return; }
    saveTownSnapshot(activeAccount.current, current.current); cancelRequest();
    activeIdentity.current = identity(account); activeAccount.current = account;
    ready.current = !account?.username; stopped.current = false;
    const next = readTownSnapshot(account, 0);
    updateWallet(next.coins); persist(next); setStatus(account?.username ? 'loading' : 'local');
  }, [account?.username, account?.pinHash, account?.accountId, cancelRequest, persist, updateWallet]);

  useEffect(() => {
    if (identity(account) !== activeIdentity.current) return;
    if (expectedWallet.current !== null) {
      if (coins !== expectedWallet.current) return;
      expectedWallet.current = null;
    }
    if (coins === wallet.current) return;
    const delta = coins - wallet.current; wallet.current = coins;
    const next = commitTownOperation(current.current, { type: 'WALLET_DELTA', delta }).snapshot;
    if (persist(next)) setStatus(pendingStatus(activeAccount.current, next));
  }, [coins, account?.username, account?.pinHash, persist]);

  const dispatch = useCallback(action => {
    const result = commitTownOperation(current.current, action, current.current.coins);
    if (result.snapshot !== current.current) {
      const saved = persist(result.snapshot); updateWallet(result.snapshot.coins);
      if (saved) setStatus(pendingStatus(activeAccount.current, result.snapshot));
    }
    if (result.notice) setNotice(result.notice);
    // Coins are already in the durable completion operation; this callback awards XP only.
    if (result.completedChapter) callbacks.current.onChapterComplete?.(result.completedChapter);
    return result;
  }, [persist, updateWallet]);

  useEffect(() => {
    const onLearning = event => {
      if (event.detail?.scope !== townScope(activeAccount.current)) return;
      const next = event.detail.snapshot || readTownSnapshot(activeAccount.current, wallet.current);
      // App owns the same coin award. Do not queue it again when props update.
      wallet.current = next.coins; expectedWallet.current = next.coins; current.current = next; setSnapshot(next);
      if (event.detail.saved === false) { stopped.current = true; setStatus('error'); setNotice('本機進度尚未存好，請保留此頁並釋放裝置空間。'); }
      else setStatus(pendingStatus(activeAccount.current, next));
    };
    window.addEventListener('englishgo:town-learning', onLearning);
    return () => window.removeEventListener('englishgo:town-learning', onLearning);
  }, []);

  const connect = useCallback((credentials, response, useLocal = false) => {
    if (!response?.ok || !response.accountId || !response.snapshot) return;
    const previous = current.current;
    if (!saveTownSnapshot(activeAccount.current, previous)) { setStatus('error'); setNotice('本機備份尚未存好，請先釋放空間。'); return; }
    cancelRequest();
    const nextAccount = { ...credentials, accountId: response.accountId };
    activeAccount.current = nextAccount; activeIdentity.current = identity(nextAccount);
    const remote = response.snapshot;
    const worldState = useLocal ? previous.worldState : normalizeTownWorld(remote.worldState || createWorld());
    const next = { worldState, coins: remote.coins, revision: response.revision, pending: [],
      needsInitialSave: !remote.worldState || useLocal };
    if (!remote.worldState) next.migrationBase = { worldState, coins: remote.coins };
    ready.current = true; stopped.current = false;
    updateWallet(next.coins); callbacks.current.setAccount(nextAccount);
    if (persist(next)) setStatus(pendingStatus(nextAccount, next));
  }, [cancelRequest, persist, updateWallet]);

  useEffect(() => {
    if (!activeAccount.current?.username || ready.current || stopped.current) return;
    const controller = new AbortController(), token = generation.current, loadingAccount = activeAccount.current;
    request.current = controller; setStatus('loading');
    requestPetAccount('load', { credentials: { username: loadingAccount.username, pinHash: loadingAccount.pinHash },
      ...(loadingAccount.accountId ? { accountId: loadingAccount.accountId } : {}) }, { signal: controller.signal }).then(response => {
      if (!mounted.current || generation.current !== token || controller.signal.aborted) return;
      if (!response.ok) { stopped.current = true; setStatus('error'); setNotice(response.error); return; }
      const local = current.current, nextAccount = { ...loadingAccount, accountId: response.accountId };
      let next;
      // Resolve an unknown save outcome with the exact durable request first.
      if (local.inFlight) next = local;
      else {
        next = rebaseTownOperations({ ...response.snapshot, revision: response.revision }, local.pending);
        if (!response.snapshot.worldState) {
          next.needsInitialSave = true;
          next.migrationBase = { worldState: createWorld(), coins: response.snapshot.coins };
        }
      }
      activeAccount.current = nextAccount; ready.current = true;
      updateWallet(next.coins); callbacks.current.setAccount(nextAccount);
      if (persist(next)) setStatus(pendingStatus(nextAccount, next));
    }).catch(() => {
      if (!controller.signal.aborted && mounted.current && generation.current === token) { stopped.current = true; setStatus('error'); setNotice('暫時連不上雲端，本機進度仍保留。'); }
    }).finally(() => { if (request.current === controller) request.current = null; });
    return () => { controller.abort(); if (request.current === controller) request.current = null; };
  }, [account?.username, account?.pinHash, retry, persist, updateWallet]);

  useEffect(() => {
    if (!ready.current || !activeAccount.current?.accountId || stopped.current
      || (!snapshot.pending.length && !snapshot.needsInitialSave && !snapshot.inFlight)) return;
    const timer = setTimeout(async () => {
      if (request.current || stopped.current) return;
      const sent = prepareTownSave(current.current);
      if (!persist(sent)) return;
      const controller = new AbortController(), token = generation.current, savingAccount = activeAccount.current;
      request.current = controller; setStatus('syncing');
      try {
        const response = await requestPetAccount('save', {
          credentials: { username: savingAccount.username, pinHash: savingAccount.pinHash },
          save: { accountId: savingAccount.accountId, baseRevision: sent.inFlight.baseRevision,
            mutationId: sent.inFlight.mutationId, snapshot: sent.inFlight.snapshot },
        }, { signal: controller.signal });
        if (!mounted.current || generation.current !== token || controller.signal.aborted) return;
        let next;
        if (response.ok) next = acknowledgeTownSave(current.current, response);
        else if (response.status === 409 && response.snapshot) {
          next = rebaseTownOperations({ ...response.snapshot, revision: response.revision }, current.current.pending);
          setNotice('已整合另一台裝置的進度，正在重新儲存。');
        } else { stopped.current = true; setStatus('error'); setNotice(response.error || '雲端暫時無法連線，本機進度仍保留。'); return; }
        updateWallet(next.coins);
        if (persist(next)) setStatus(pendingStatus(activeAccount.current, next));
      } catch {
        if (!controller.signal.aborted && mounted.current && generation.current === token) {
          stopped.current = true; setStatus('error'); setNotice('同步尚未確認，重試時會使用同一筆存檔。');
        }
      } finally { if (request.current === controller) request.current = null; }
    }, 1500);
    // Debounce new actions, but only an account/page change aborts an active save.
    return () => clearTimeout(timer);
  }, [snapshot, retry, persist, updateWallet]);

  const retrySync = useCallback(() => {
    if (!saveTownSnapshot(activeAccount.current, current.current)) return;
    stopped.current = false; setRetry(value => value + 1);
  }, []);
  useEffect(() => { window.addEventListener('online', retrySync); return () => window.removeEventListener('online', retrySync); }, [retrySync]);
  const logout = useCallback(() => {
    if (!saveTownSnapshot(activeAccount.current, current.current)) { setStatus('error'); setNotice('本機存檔尚未保存，請稍後重試登出。'); return; }
    cancelRequest(); activeAccount.current = null; activeIdentity.current = 'guest'; ready.current = true; stopped.current = false;
    const guest = readTownSnapshot(null, 0);
    updateWallet(guest.coins); callbacks.current.setAccount(null);
    if (persist(guest)) setStatus('local');
  }, [cancelRequest, persist, updateWallet]);
  return { world: snapshot.worldState, dispatch, status, notice, setNotice, connect, logout, retrySync };
}
