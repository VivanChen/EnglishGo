export const ARCADE_GAMES = {
  whack: { title: '地鼠花園', subtitle: '聽音找字', icon: '🌼', color: '#287957', stages: ['花園初探', '森林朋友', '小耳朵達人'], description: '聽清楚、找對字，讓小地鼠種滿一座花園。', instructions: ['看中文、聽發音，找到拿著正確英文的地鼠。', '每找到一個單字，就能種下一朵花。', '第 3 關挑戰模式先聽音辨字，需要時可以看提示。'] },
  match: { title: '記憶星空', subtitle: '單字配對', icon: '✦', color: '#6758aa', stages: ['月光小徑', '星星連線', '銀河收藏家'], description: '找到英文與中文的夥伴，點亮自己的星座。', instructions: ['選一張英文和一張中文，找出同一組意思。', '輕鬆模式牌面全開；挑戰模式先看 3 秒再蓋牌。', '配錯也沒關係，記住位置，再來一次。'] },
  bomb: { title: '火箭拼字', subtitle: '字母解謎', icon: '🚀', color: '#337caa', stages: ['準備起飛', '月球補給', '星際探險'], description: '把字母裝進能量槽，送小火箭飛向下一顆星球。', instructions: ['看中文或聽發音，用字母積木拼出英文。', '也可以直接用鍵盤輸入，再按「發射能量」。', '後面的關卡會加入多餘字母，看仔細再選。'] },
  scramble: { title: '句子小火車', subtitle: '語序解謎', icon: '🚂', color: '#b16638', stages: ['第一班列車', '跨越小山', '環島小車長'], description: '把單字車廂排好隊，載著一句英文向前出發。', instructions: ['依照中文意思，點單字，把車廂排成一句話。', '點車廂可以拿回來，也能退回最後一個。', '第 3 關有多餘車廂，選對單字就能出發。'] },
};

export function shuffleArcade(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export const shortMeaning = value => String(value || '').split(/[；;，,、/]/)[0].trim();
export function arcadeWords(words) {
  const seen = new Set();
  return (words || []).filter(word => {
    const key = String(word?.w || '').trim().toLowerCase();
    if (!/^[a-z]{2,18}$/.test(key) || !shortMeaning(word.m) || seen.has(key)) return false;
    seen.add(key); return true;
  }).map(word => ({ ...word, w: word.w.trim().toLowerCase() }));
}
export function buildArcadeRound({ game, stage = 1, mode = 'practice', lv = 'elementary', words = [], sentences = [], previous = [], random = Math.random }) {
  const pool = arcadeWords(words), cap = (lv === 'elementary' ? 5 : lv === 'junior' ? 8 : 11) + (stage - 1) * 3;
  const suitable = pool.filter(word => word.w.length <= cap);
  const levelPool = suitable.length >= 6 ? suitable : pool;
  const familiar = levelPool.filter(word => /^(n\.|adj\.)/.test(String(word.p || '')));
  const source = stage === 1 && familiar.length >= 6 ? familiar : levelPool;
  const candidates = shuffleArcade(source, random).sort((a, b) => Number(previous.includes(a.w)) - Number(previous.includes(b.w)));
  const count = game === 'match' ? [3, 4, 6][stage - 1] : [3, 4, 5][stage - 1];
  let rounds;
  if (game === 'scramble') {
    rounds = shuffleArcade(sentences.filter(item => item?.s && item?.h), random).slice(0, count).map(item => {
      const tokens = item.s.trim().split(/\s+/);
      const extras = stage === 3 ? ['hello', 'yes'].filter(word => !tokens.some(token => token.toLowerCase() === word)) : [];
      let tiles = shuffleArcade([...tokens, ...extras].map((text, id) => ({ text, id })), random);
      if (tiles.map(tile => tile.text).join(' ') === item.s && tiles.length > 1) tiles = [...tiles.slice(1), tiles[0]];
      return { ...item, tokens, tiles };
    });
  } else {
    const meanings = new Set();
    rounds = candidates.filter(word => { const key = shortMeaning(word.m); if (meanings.has(key)) return false; meanings.add(key); return true; }).slice(0, count).map(word => {
      const distractors = shuffleArcade(source.filter(other => other.w !== word.w && shortMeaning(other.m) !== shortMeaning(word.m)), random).slice(0, 3);
      const extraLetters = shuffleArcade('abcdefghijklmnopqrstuvwxyz'.split('').filter(letter => !word.w.includes(letter)), random).slice(0, stage - 1);
      return { ...word, choices: shuffleArcade([word, ...distractors], random), letters: shuffleArcade([...word.w, ...extraLetters], random) };
    });
  }
  const board = game === 'match' ? shuffleArcade(rounds.flatMap((word, pair) => [{ pair, type: 'en', text: word.w }, { pair, type: 'zh', text: shortMeaning(word.m) }]), random) : [];
  return { game, stage, mode, rounds, board, phase: rounds.length ? 'playing' : 'empty', index: 0, input: '', selected: [], flipped: [], matched: [], rejected: [], moves: 0, mistakes: 0, hints: 0, hinted: false, combo: 0, bestCombo: 0, points: 0, earned: 0, completed: 0, answered: false, feedback: null, pendingMs: 0, peekMs: game === 'match' && mode === 'challenge' ? 3000 : 0, remainingMs: (game === 'scramble' ? 150 : game === 'match' ? 100 : 90) * 1000 + (stage - 1) * 30000 };
}

function success(state) {
  const combo = state.combo + 1;
  return { ...state, completed: state.completed + 1, answered: true, combo, bestCombo: Math.max(state.bestCombo, combo), points: state.points + (state.hinted ? 60 : 100 + Math.min(combo - 1, 5) * 20), earned: state.earned + (state.hinted ? 5 : 10), feedback: { kind: 'success', text: ['做到了！這一小步很棒。', '又找到一個！繼續向前。', '連續成功，越來越熟悉了！'][Math.min(combo - 1, 2)] } };
}
function mistake(state, text) { return { ...state, mistakes: state.mistakes + 1, combo: 0, feedback: { kind: 'retry', text } }; }
export function arcadeReducer(state, action) {
  if (action.type === 'START') return action.state;
  if (!state) return state;
  if (action.type === 'PAUSE' && state.phase === 'playing') return { ...state, phase: 'paused' };
  if (action.type === 'RESUME' && state.phase === 'paused') return { ...state, phase: 'playing' };
  if (state.phase !== 'playing') return state;
  const current = state.rounds[state.index];
  if (action.type === 'TICK') {
    const delta = Math.max(0, Number(action.ms) || 0);
    const remainingMs = state.mode === 'challenge' && !state.answered ? Math.max(0, state.remainingMs - delta) : state.remainingMs;
    const pendingMs = Math.max(0, state.pendingMs - delta), peekMs = Math.max(0, state.peekMs - delta);
    return { ...state, remainingMs, pendingMs, peekMs, flipped: state.pendingMs && !pendingMs ? [] : state.flipped, phase: remainingMs === 0 ? 'timeout' : 'playing' };
  }
  if (action.type === 'NEXT' && state.answered) return state.completed >= state.rounds.length ? { ...state, phase: 'won' } : { ...state, index: state.index + 1, input: '', selected: [], rejected: [], answered: false, hinted: false, feedback: null };
  if (state.answered) return state;
  if (state.game === 'match' && (state.pendingMs || state.peekMs)) return state;
  if (action.type === 'HINT') {
    const next = { ...state, hints: state.hints + 1, hinted: true, feedback: { kind: 'hint', text: '小幫手來了！看看線索，再試試看。' } };
    if (state.game === 'match') return { ...next, peekMs: 2500 };
    if (state.game === 'bomb') { let prefix = 0; while (prefix < current.w.length && state.input[prefix] === current.w[prefix]) prefix++; return { ...next, input: current.w.slice(0, prefix + 1) }; }
    if (state.game === 'scramble') {
      const selected = []; let prefix = 0;
      while (prefix < current.tokens.length && current.tiles.find(tile => tile.id === state.selected[prefix])?.text === current.tokens[prefix]) { selected.push(state.selected[prefix]); prefix++; }
      const tile = current.tiles.find(item => !selected.includes(item.id) && item.text === current.tokens[prefix]);
      return { ...next, selected: tile ? [...selected, tile.id] : selected };
    }
    return next;
  }
  if (state.game === 'match' && action.type === 'FLIP') {
    const card = state.board[action.index];
    if (!card || state.flipped.includes(action.index) || state.matched.includes(card.pair)) return state;
    const flipped = [...state.flipped, action.index];
    if (flipped.length === 1) return { ...state, flipped, feedback: null };
    const first = state.board[flipped[0]], moves = state.moves + 1;
    if (first.pair !== card.pair) return { ...mistake(state, '記住這兩張的位置，再找找它們的夥伴。'), moves, flipped, pendingMs: 1200 };
    const matched = [...state.matched, card.pair], next = success(state);
    return { ...next, matched, moves, flipped, answered: false, hinted: false, pendingMs: 500, phase: matched.length === state.rounds.length ? 'won' : 'playing', feedback: { kind: 'success', text: `${state.rounds[card.pair].w} · ${shortMeaning(state.rounds[card.pair].m)}，連上了！` } };
  }
  if (state.game === 'whack' && action.type === 'CHOOSE') {
    const chosen = current.choices[action.index];
    if (!chosen || state.rejected.includes(action.index)) return state;
    return chosen.w === current.w ? success(state) : { ...mistake(state, '這隻還不是，聽聽看再找一次。'), rejected: [...state.rejected, action.index] };
  }
  if (state.game === 'bomb') {
    if (action.type === 'INPUT') return { ...state, input: String(action.value).toLowerCase().replace(/[^a-z]/g, '').slice(0, current.w.length), feedback: null };
    if (action.type === 'LETTER' && state.input.length < current.w.length) {
      const letter = action.letter;
      if (!current.letters.includes(letter) || [...state.input].filter(item => item === letter).length >= current.letters.filter(item => item === letter).length) return state;
      return { ...state, input: state.input + letter, feedback: null };
    }
    if (action.type === 'UNDO') return { ...state, input: state.input.slice(0, -1), feedback: null };
    if (action.type === 'CHECK' && state.input.length === current.w.length) return state.input === current.w ? success(state) : mistake(state, '能量還差一點，換換字母，或請小幫手幫忙。');
  }
  if (state.game === 'scramble') {
    if (action.type === 'TOKEN') {
      if (!current.tiles.some(tile => tile.id === action.id)) return state;
      if (state.selected.includes(action.id)) return { ...state, selected: state.selected.filter(id => id !== action.id), feedback: null };
      if (state.selected.length >= current.tokens.length) return state;
      return { ...state, selected: [...state.selected, action.id], feedback: null };
    }
    if (action.type === 'UNDO') return { ...state, selected: state.selected.slice(0, -1), feedback: null };
    if (action.type === 'CHECK' && state.selected.length === current.tokens.length) {
      const text = state.selected.map(id => current.tiles.find(tile => tile.id === id).text).join(' ');
      return text.toLowerCase() === current.s.toLowerCase() ? success(state) : mistake(state, '車廂順序再調整一下，從「誰做了什麼」開始想。');
    }
  }
  return state;
}

export const arcadeStars = state => state.phase !== 'won' ? 0 : 1 + Number(state.mistakes <= 2) + Number(state.mistakes === 0 && state.hints === 0);
export function readArcadeProgress() { try { return JSON.parse(localStorage.getItem('eg_arcade_progress')) || {}; } catch { return {}; } }
export function stageRecords(progress, lv, game, mode) { return progress?.[lv]?.[game]?.[mode] || {}; }
export function saveArcadeProgress(progress, lv, state) {
  const records = stageRecords(progress, lv, state.game, state.mode), old = records[state.stage] || {};
  return { ...progress, [lv]: { ...progress?.[lv], [state.game]: { ...progress?.[lv]?.[state.game], [state.mode]: { ...records, [state.stage]: { stars: Math.max(Number(old.stars) || 0, arcadeStars(state)), points: Math.max(Number(old.points) || 0, state.points) } } } } };
}
