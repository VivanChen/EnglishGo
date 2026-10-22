import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpeakingStudio from './SpeakingStudio.jsx';
import { mockVoiceRecording } from '../test/voiceRecordingMock.js';

let media;
const original = [window.SpeechRecognition, window.webkitSpeechRecognition];
const card = { word: 'water', meaning: '水', en: 'Please drink more water.', zh: '請多喝水。', type: 'sentence' };
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
beforeEach(() => { media = mockVoiceRecording(); });
afterEach(() => { cleanup(); media.restore(); vi.restoreAllMocks(); [window.SpeechRecognition, window.webkitSpeechRecognition] = original; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
function setup(recognition = true) {
  const instances = [];
  window.SpeechRecognition = recognition ? class {
    constructor() { instances.push(this); }
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();
    answer() { this.onresult?.({ results: [Object.assign([{ transcript: card.en, confidence: 1 }], { isFinal: true })] }); this.onend?.(); }
  } : undefined;
  window.webkitSpeechRecognition = undefined;
  const deps = {
    Hdr: ({ onBack }) => <button onClick={onBack}>返回</button>, c: {}, fallback: [], fetchSpeakItems: vi.fn(),
    speak: vi.fn(() => ({})), stopSpeech: vi.fn(), playSound: vi.fn(), localPronunciationGuide: () => null,
    compareWords: () => ({ pct: 100, result: [{ word: card.en, ok: true }], extra: [] }), speakPassThreshold: () => 80,
  };
  const props = { lv: 'elementary', cardPractice: card, onBack: vi.fn(), onXp: vi.fn(), deps };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () { fireEvent.play(this); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { fireEvent.pause(this); });
  return { ...render(<StrictMode><SpeakingStudio {...props} /></StrictMode>), props, deps, instances };
}
const begin = async (label = '🎤 直接開說') => { await act(async () => click(label)); };
const finish = () => { click('■ 說好了，停止'); act(() => media.instances.at(-1).finish()); };

describe('speaking with own-voice playback', () => {
  it('records the same attempt as recognition, makes the original audio replayable and keeps demo playback exclusive', async () => {
    const view = setup();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    await begin();
    expect(view.instances).toHaveLength(1);
    act(() => view.instances[0].answer());
    expect(media.tracks[0].stop).toHaveBeenCalled();
    act(() => media.instances[0].finish());
    expect(view.props.onXp).toHaveBeenCalledOnce();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    const audio = view.container.querySelector('audio');
    expect(audio.src).toBe('blob:voice-1');
    click('▶ 聽我的錄音');
    expect(screen.getByRole('button', { name: '■ 停止回放' })).toBeInTheDocument();
    click('🔊 和示範比較');
    expect(audio.pause).toHaveBeenCalled();
    expect(view.deps.speak).toHaveBeenLastCalledWith(card.en, 'en-US', .85, expect.any(Object));
    const speech = view.deps.speak.mock.lastCall[3];
    act(() => { speech.onstart(); speech.onboundary({ charIndex: 7 }); });
    expect(view.container.querySelector('.is-current')).toHaveTextContent('drink');
    click('▶ 聽我的錄音');
    expect(view.container.querySelector('.is-current')).toBeNull();
    expect(screen.queryByText('■ 停止示範')).not.toBeInTheDocument();
    expect(view.props.onXp).toHaveBeenCalledOnce();
    click('完成');
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    expect(view.container.querySelector('audio')).toBeNull();
  });
  it.each([true, false])('supports recording without recognition or rewards (recognition available: %s)', async recognition => {
    const view = setup(recognition);
    await begin(recognition ? '只錄音回聽' : '🎤 直接開說');
    finish();
    expect(view.instances).toHaveLength(0);
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(screen.getByRole('region', { name: '我的錄音' })).toBeInTheDocument();
    click('刪除錄音');
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    expect(screen.queryByRole('region', { name: '我的錄音' })).not.toBeInTheDocument();
  });
  it('keeps recording available after recognition fails and shows playback only after stopping', async () => {
    const view = setup();
    await begin();
    act(() => view.instances[0].onerror({ error: 'network' }));
    expect(screen.getByRole('alert')).toHaveTextContent('語音辨識暫時連不上');
    expect(media.tracks[0].stop).not.toHaveBeenCalled();
    finish();
    expect(screen.getByRole('button', { name: '▶ 聽我的錄音' })).toBeInTheDocument();
    expect(view.props.onXp).not.toHaveBeenCalled();
  });
  it('cancels pending permission before starting a demo and never starts late recognition', async () => {
    let resolve;
    media.getUserMedia.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const view = setup(), track = { stop: vi.fn() };
    await begin();
    click('🔊 聽示範');
    await act(async () => resolve({ getTracks: () => [track] }));
    expect(track.stop).toHaveBeenCalled();
    expect(view.instances).toHaveLength(0);
    expect(screen.queryByText('取消這次錄音')).not.toBeInTheDocument();
  });
  it('clears recordings on rerecord and stops capture when the page is hidden', async () => {
    const view = setup();
    await begin('只錄音回聽'); finish();
    await begin('重新錄音');
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    expect(view.container.querySelector('audio')).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange'));
    expect(media.tracks[1].stop).toHaveBeenCalled();
    expect(view.instances).toHaveLength(0);
    act(() => media.instances[1].finish());
    expect(media.createObjectURL).toHaveBeenCalledOnce();
  });
  it('handles rejected playback without breaking retry or reporting a recording reward', async () => {
    const view = setup();
    await begin('只錄音回聽'); finish();
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error('blocked'));
    await act(async () => click('▶ 聽我的錄音'));
    expect(screen.getByRole('alert')).toHaveTextContent('錄音暫時無法播放');
    click('▶ 聽我的錄音');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    click('🔊 和示範比較');
    HTMLMediaElement.prototype.play.mockRejectedValueOnce({ name: 'AbortError' });
    await act(async () => click('▶ 聽我的錄音'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(view.props.onXp).not.toHaveBeenCalled();
  });
});
