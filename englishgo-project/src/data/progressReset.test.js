import { describe, expect, it, vi } from 'vitest';
import { PROGRESS_VERSION, PROGRESS_VERSION_KEY, resetProgressOnce } from './progressReset.js';

describe('Seabreeze fresh start', () => {
  it('clears all app progress and old backups, including per-account worlds and learning modules', () => {
    const keys = ['eg_coins','eg_xp','eg_pets','eg_eggs','eg_inv','eg_daily','eg_hist','eg_stats',
      'eg_ach','eg_weak','eg_loginBonus','eg_streak','eg_srs_elementary','eg_novelDone',
      'eg_novelReadingProgress','eg_arcade_progress','eg_pictureBookGuide:pip:v1',
      'eg_card_speaking_elementary_test','eg_song_studio_junior','eg_tutor_studio_senior',
      'eg_grammar_workshop_elementary','eg_pet_world_v2:guest','eg_pet_world_v2:account:test',
      'eg_pet_legacy_backup:guest'];
    for (const key of keys) localStorage.setItem(key, 'old-progress');
    sessionStorage.setItem('eg_srs_session','old-session');
    expect(resetProgressOnce(localStorage, sessionStorage)).toBe(true);
    for (const key of keys) expect(localStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem('eg_srs_session')).toBeNull();
    expect(localStorage.getItem(PROGRESS_VERSION_KEY)).toBe(PROGRESS_VERSION);
    expect([...Object.keys(localStorage)].some(key => key.includes('backup'))).toBe(false);
  });
  it('keeps credentials, API settings, accessibility preferences and unrelated site data', () => {
    const keys = ['eg_petAcc','eg_gemkey','eg_gifkey','eg_tts_provider','eg_openai_tts_voice',
      'eg_gemini_model','eg_dark','eg_quiet','eg_calm','eg_novelReadingPrefs','other-site'];
    for (const key of keys) localStorage.setItem(key,'setting');
    resetProgressOnce(localStorage);
    for (const key of keys) expect(localStorage.getItem(key)).toBe('setting');
  });
  it('runs once and retains new coins, learning and pets on every subsequent launch', () => {
    resetProgressOnce(localStorage);
    localStorage.setItem('eg_coins','5'); localStorage.setItem('eg_xp','15');
    localStorage.setItem('eg_pet_world_v2:guest','new-world');
    expect(resetProgressOnce(localStorage)).toBe(false);
    expect(localStorage.getItem('eg_coins')).toBe('5');
    expect(localStorage.getItem('eg_xp')).toBe('15');
    expect(localStorage.getItem('eg_pet_world_v2:guest')).toBe('new-world');
  });
  it('drops an old study session from browser history before the app restores navigation', () => {
    window.history.replaceState({ other:'kept', englishGoNavigation: {lv:'elementary',mod:'srs',
      menuGroup:'learn',srsSession:{cards:['old'],cursor:3},cardPractice:{word:'old'},depth:4} }, '');
    resetProgressOnce(localStorage, null, window.history);
    expect(window.history.state).toEqual({other:'kept',englishGoNavigation:{lv:'elementary',mod:'srs',menuGroup:'learn',depth:0}});
  });
  it('does not mark a partial reset complete when storage removal fails', () => {
    localStorage.setItem('eg_coins','999');
    const spy=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('unavailable');});
    try { expect(()=>resetProgressOnce(localStorage)).toThrow(); expect(localStorage.getItem(PROGRESS_VERSION_KEY)).toBeNull(); }
    finally { spy.mockRestore(); }
    expect(resetProgressOnce(localStorage)).toBe(true);
    expect(localStorage.getItem('eg_coins')).toBeNull();
  });
});
