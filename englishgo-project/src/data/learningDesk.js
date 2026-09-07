export const wordIdentity = word => `${word?.level || ''}:${String(word?.w || '').toLowerCase()}`;
export const isDeskWord = word => word && typeof word.w === 'string' && word.w.trim() && typeof word.m === 'string';
export function readExplorer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    query: typeof raw.query === 'string' ? raw.query.slice(0, 80) : '', scope: raw.scope === 'current' ? 'current' : 'all',
    tab: raw.tab === 'saved' ? 'saved' : 'search', selected: isDeskWord(raw.selected) ? raw.selected : null,
    favorites: [...new Map((Array.isArray(raw.favorites) ? raw.favorites : []).filter(isDeskWord).map(word => [wordIdentity(word), word])).values()].slice(0, 50),
    recent: [...new Set((Array.isArray(raw.recent) ? raw.recent : []).filter(word => typeof word === 'string' && word.trim()).map(word => word.slice(0, 80)))].slice(0, 8),
    large: raw.large === true,
  };
}

// A bounded wait also settles when a provider ignores AbortSignal. Late results are discarded.
export function deskRequest(task, { signal, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false, timer;
    const finish = (value, error) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(null, Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(null, Object.assign(new Error('Timed out'), { name: 'TimeoutError' })), timeout);
    Promise.resolve().then(() => { if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); return task(); }).then(value => finish(value), error => finish(null, error));
  });
}

export const DESK_LIMITS = { sessions: 8, turns: 20, saved: 24, question: 1200 };
export const deskId = () => globalThis.crypto?.randomUUID?.() || `desk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function newTutorSession() { return { id: deskId(), title: '新的小練習', draft: '', turns: [], mode: 'sentence' }; }
export function readTutorBook(raw) {
  if (!raw || !Array.isArray(raw.sessions)) return null;
  const seen = new Set();
  const sessions = raw.sessions.filter(session => typeof session?.id === 'string' && !seen.has(session.id) && seen.add(session.id)).slice(0, DESK_LIMITS.sessions).map(session => ({
    id: session.id, title: String(session.title || '小練習').slice(0, 40), mode: String(session.mode || 'sentence'), draft: String(session.draft || '').slice(0, DESK_LIMITS.question),
    turns: (Array.isArray(session.turns) ? session.turns : []).filter(turn => typeof turn?.id === 'string' && typeof turn.question === 'string').slice(0, DESK_LIMITS.turns).map(turn => ({
      id: turn.id, question: turn.question.slice(0, DESK_LIMITS.question), answer: typeof turn.answer === 'string' ? turn.answer.slice(0, 10000) : '',
      status: turn.status === 'done' && turn.answer?.trim() ? 'done' : turn.status === 'failed' ? 'failed' : 'stopped', error: String(turn.error || ''),
    })),
  }));
  if (!sessions.length) sessions.push(newTutorSession());
  const saved = (Array.isArray(raw.saved) ? raw.saved : []).filter(item => typeof item?.id === 'string' && typeof item.text === 'string').slice(0, DESK_LIMITS.saved);
  return { sessions, activeId: sessions.some(session => session.id === raw.activeId) ? raw.activeId : sessions[0].id, saved,
    rate: [.6, .85, 1.15].includes(raw.rate) ? raw.rate : .85 };
}
export function tutorContents(turns, question) {
  const complete = turns.filter(turn => turn.status === 'done' && turn.answer).slice(-5);
  return [...complete.flatMap(turn => [{ role: 'user', parts: [{ text: turn.question }] }, { role: 'model', parts: [{ text: turn.answer }] }]), { role: 'user', parts: [{ text: question }] }];
}
export function tutorError(error) {
  if (error?.name === 'TimeoutError') return '等候有點久，問題已保留，可以稍後再試。';
  const message = String(error?.message || '');
  if (/403|401|API.?KEY|permission|invalid/i.test(message)) return 'AI 設定需要檢查，請大人到設定頁幫忙。';
  if (/429|quota|rate/i.test(message)) return 'AI 暫時達到使用上限，先休息一下，稍後再試。';
  return 'AI 暫時沒有回答，問題已保留，可以重試或換個練習。';
}
