import { describe, expect, it } from 'vitest';
import { arcadeReducer, arcadeStars, arcadeWords, buildArcadeRound, saveArcadeProgress, stageRecords } from './arcade.js';

const words = ['apple','book','cat','dog','fish','sun','tree','car'].map((w, index) => ({ w, m: `意思${index}` }));
const setup = (game, options = {}) => buildArcadeRound({ game, words, random: () => .4, ...options });
const act = (state, type, args = {}) => arcadeReducer(state, { type, ...args });
function solveWord(state) { return state.game === 'whack' ? act(state, 'CHOOSE', { index: state.rounds[state.index].choices.findIndex(word => word.w === state.rounds[state.index].w) }) : act(act(state, 'INPUT', { value: state.rounds[state.index].w }), 'CHECK'); }

describe('arcade rounds and reward boundaries', () => {
  it('filters unusable vocabulary and never mutates the source', () => {
    const source = [...words, { w:'CAT', m:'重複' }, { w:'ice cream', m:'冰淇淋' }, { w:'x', m:'' }];
    const snapshot = JSON.stringify(source);
    expect(arcadeWords(source)).toHaveLength(8);
    setup('bomb'); expect(JSON.stringify(source)).toBe(snapshot);
  });
  it('uses distinct meanings and finishes smaller decks without waiting for nonexistent pairs', () => {
    let state = setup('match', { stage:3, words:[...words.slice(0,3), { w:'duplicate',m:words[0].m }] });
    expect(state.rounds).toHaveLength(3);
    for (let pair=0;pair<3;pair++) {
      const indexes = state.board.map((card,index)=>card.pair===pair?index:-1).filter(index=>index>=0);
      state=act(act(state,'FLIP',{index:indexes[0]}),'FLIP',{index:indexes[1]});
      state=act(state,'TICK',{ms:500});
    }
    expect(state.phase).toBe('won'); expect(state.earned).toBe(30);
  });
  it('raises the number of objectives and introduces spelling distractors', () => {
    const easy=setup('bomb'),advanced=setup('bomb',{stage:3});
    expect(easy.rounds).toHaveLength(3);expect(advanced.rounds).toHaveLength(5);
    expect(easy.rounds[0].letters).toHaveLength(easy.rounds[0].w.length);
    expect(advanced.rounds[0].letters).toHaveLength(advanced.rounds[0].w.length+2);
  });
  it('prefers concrete vocabulary in the first stage when a usable pool exists', () => {
    const concrete = words.map(word => ({...word,p:'n.'}));
    const state=setup('whack',{words:[{w:'for',m:'為了',p:'prep.'},...concrete]});
    expect(state.rounds.every(word=>word.p==='n.')).toBe(true);
    expect(state.rounds.flatMap(word=>word.choices).some(word=>word.w==='for')).toBe(false);
  });
  it('does not count time in practice, while paused, or while reading successful feedback', () => {
    let practice=setup('whack');expect(act(practice,'TICK',{ms:1000}).remainingMs).toBe(practice.remainingMs);
    let timed=setup('whack',{mode:'challenge'});timed=act(timed,'TICK',{ms:1000});expect(timed.remainingMs).toBe(89000);
    const paused=act(timed,'PAUSE');expect(act(paused,'TICK',{ms:1000})).toBe(paused);
    const success=solveWord(act(paused,'RESUME'));expect(act(success,'TICK',{ms:1000}).remainingMs).toBe(89000);
  });
  it('rejects rapid repeated answers, next clicks, and actions after completion', () => {
    let state=solveWord(setup('bomb'));expect(state.earned).toBe(10);
    expect(act(state,'CHECK')).toBe(state);
    const next=act(state,'NEXT');expect(act(next,'NEXT')).toBe(next);
    state=act(solveWord(next),'NEXT');state=act(solveWord(state),'NEXT');
    expect(state.phase).toBe('won');expect(state.completed).toBe(3);expect(state.earned).toBe(30);
    expect(act(state,'CHECK')).toBe(state);expect(arcadeStars(state)).toBe(3);
  });
  it('locks unresolved memory cards and pays a pair only once', () => {
    let state=setup('match');const first=0,other=state.board.findIndex(card=>card.pair!==state.board[0].pair);
    state=act(act(state,'FLIP',{index:first}),'FLIP',{index:other});
    expect(state.mistakes).toBe(1);expect(state.earned).toBe(0);
    expect(act(state,'FLIP',{index:2})).toBe(state);
    state=act(state,'TICK',{ms:1200});expect(state.flipped).toEqual([]);
    const partner=state.board.findIndex((card,index)=>index!==first&&card.pair===state.board[first].pair);
    state=act(act(state,'FLIP',{index:first}),'FLIP',{index:partner});
    expect(state.earned).toBe(10);
    state=act(state,'TICK',{ms:500});expect(act(state,'FLIP',{index:first})).toBe(state);
  });
  it('conceals challenge memory cards after the preview and allows a counted hint', () => {
    let state=setup('match',{mode:'challenge'});expect(state.peekMs).toBe(3000);
    expect(act(state,'FLIP',{index:0})).toBe(state);
    state=act(act(state,'TICK',{ms:2000}),'TICK',{ms:1000});expect(state.peekMs).toBe(0);
    state=act(state,'HINT');expect(state.peekMs).toBe(2500);expect(state.hints).toBe(1);
  });
  it('supports repeated letters without creating extra letter tiles', () => {
    let state=setup('bomb',{words:[{w:'apple',m:'蘋果'}]});
    state=act(act(state,'LETTER',{letter:'p'}),'LETTER',{letter:'p'});
    expect(state.input).toBe('pp');expect(act(state,'LETTER',{letter:'p'})).toBe(state);
    state=act(state,'UNDO');expect(act(state,'LETTER',{letter:'p'}).input).toBe('pp');
    state=act(state,'HINT');expect(state.input).toBe('a');expect(state.hints).toBe(1);
  });
  it('restores a correct sentence prefix with a hint and handles repeated words', () => {
    let state=setup('scramble',{sentences:[{s:'I know that that is good',h:'我知道那很好'}],stage:3});
    const wrong=state.rounds[0].tiles.find(tile=>tile.text==='good');
    state=act(state,'TOKEN',{id:wrong.id});state=act(state,'HINT');
    expect(state.rounds[0].tiles.find(tile=>tile.id===state.selected[0]).text).toBe('I');
    for(let i=1;i<6;i++)state=act(state,'HINT');
    expect(new Set(state.selected).size).toBe(6);
    state=act(state,'CHECK');expect(state.answered).toBe(true);expect(state.earned).toBe(5);
    expect(arcadeStars(act(state,'NEXT'))).toBe(2);
  });
  it('retains earned XP on timeout and stops further gameplay', () => {
    let state=act(solveWord(setup('whack',{mode:'challenge'})),'NEXT');
    state=act({...state,remainingMs:500},'TICK',{ms:1000});
    expect(state.phase).toBe('timeout');expect(state.earned).toBe(10);expect(arcadeStars(state)).toBe(0);
    expect(act(state,'CHOOSE',{index:0})).toBe(state);
  });
  it('stores best records independently by grade, game and mode', () => {
    const won={...setup('bomb'),phase:'won',points:350};
    let progress=saveArcadeProgress({},'elementary',won);
    progress=saveArcadeProgress(progress,'elementary',{...won,points:200,mistakes:4});
    expect(stageRecords(progress,'elementary','bomb','practice')[1]).toEqual({stars:3,points:350});
    expect(stageRecords(progress,'junior','bomb','practice')).toEqual({});
    expect(stageRecords(progress,'elementary','bomb','challenge')).toEqual({});
    expect(stageRecords(progress,'elementary','match','practice')).toEqual({});
  });
});
