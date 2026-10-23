import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpeakingStudio from './SpeakingStudio.jsx';
import { mockVoiceRecording } from '../test/voiceRecordingMock.js';
import { assessRecording } from './recordingAssessmentService.js';
vi.mock('./recordingAssessmentService.js', () => ({ assessRecording: vi.fn() }));

let media;
const original = [window.SpeechRecognition, window.webkitSpeechRecognition];
const card = { word: 'water', meaning: '水', en: 'Please drink more water.', zh: '請多喝水。', type: 'sentence' };
const report = { speechDetected: true, transcript: card.en, delivery: 'clear', tip: 'keep_going', focus: 'water' };
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
beforeEach(() => { media = mockVoiceRecording(); assessRecording.mockReset().mockResolvedValue(report); });
afterEach(() => { cleanup(); media.restore(); vi.restoreAllMocks(); [window.SpeechRecognition, window.webkitSpeechRecognition] = original; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
function setup(extra = {}) {
  const recognition = vi.fn(); window.SpeechRecognition = recognition; window.webkitSpeechRecognition = recognition;
  const deps = {
    Hdr: ({ onBack }) => <button onClick={onBack}>返回</button>, c: {}, fallback: [], fetchSpeakItems: vi.fn(),
    speak: vi.fn(() => ({})), stopSpeech: vi.fn(), playSound: vi.fn(), localPronunciationGuide: () => null,
    compareWords: vi.fn((target, heard) => ({ pct: target === heard ? 100 : 75, result: target.split(' ').map(word => ({ word, ok: heard.includes(word) })), extra: [] })), speakPassThreshold: () => 80,
  };
  const props = { lv: 'elementary', cardPractice: card, apiKey: 'test', onBack: vi.fn(), onXp: vi.fn(), onOpenSettings: vi.fn(), deps, ...extra };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () { fireEvent.play(this); return Promise.resolve(); });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () { fireEvent.pause(this); });
  return { ...render(<StrictMode><SpeakingStudio {...props} /></StrictMode>), props, deps, recognition };
}
const begin = async (label = '🎤 錄音並檢查') => { await act(async () => click(label)); };
const finish = async () => { await act(async () => { click('■ 說好了'); media.instances.at(-1).finish(); }); };

describe('one recording, one check', () => {
  it('keeps optional activities out of the recording path and restores the sentence on retry', async () => {
    const view = setup();
    const steps = screen.getByRole('list', { name: '練習步驟' });
    expect(steps.querySelector('[aria-current=step]')).toHaveTextContent('聽一聽');
    expect(screen.queryByRole('button', { name: '🧩 聽音拼句' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('想多練一下？')); click('帶我逐段跟讀 →');
    const oldSpeech = view.deps.speak.mock.lastCall[3];
    fireEvent.click(screen.getByText('想多練一下？'));
    act(() => oldSpeech.onstart());
    expect(screen.queryByRole('region', { name: '分段聽說' })).not.toBeInTheDocument();
    expect(view.container.querySelector('.is-current')).toBeNull();
    await begin();
    expect(steps.querySelector('[aria-current=step]')).toHaveTextContent('說一說');
    expect(screen.queryByText('想多練一下？')).not.toBeInTheDocument();
    await finish();
    expect(steps.querySelector('[aria-current=step]')).toHaveTextContent('聽回饋');
    expect(within(screen.getByRole('region', { name: '這次錄音的小提示' })).getByRole('region', { name: '我的錄音' })).toBeVisible();
    await begin('🎤 再說一次');
    expect(screen.getByRole('heading', { name: card.zh })).toHaveFocus();
    expect(view.container.querySelector('.workshop-spoken-target')).toHaveTextContent(card.en);
    click('取消這次錄音');
    expect(screen.getByRole('button', { name: '🎤 錄音並檢查' })).toHaveFocus();
  });
  it.each(['no key', 'silence', 'error'])('allows continuing after %s without a false pass or reward', async scenario => {
    if (scenario === 'silence') assessRecording.mockResolvedValue({ speechDetected: false });
    if (scenario === 'error') assessRecording.mockRejectedValue({ kind: 'network' });
    const view = setup({ apiKey: scenario === 'no key' ? '' : 'test' });
    await begin(scenario === 'no key' ? '🎤 開始錄音' : '🎤 錄音並檢查'); await finish();
    click('先跳過這題 →');
    expect(screen.getByRole('region', { name: '口說練習完成' })).toBeVisible();
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(view.deps.compareWords).not.toHaveBeenCalled();
    expect(screen.getByText('下次可以再練')).toBeVisible();
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
  });
  it('does not move focus away from replay when an asynchronous check finishes', async () => {
    let resolve; assessRecording.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = setup(); await begin(); await finish();
    const replay = screen.getByRole('button', { name: '▶ 聽我的錄音' });
    replay.focus(); click('▶ 聽我的錄音');
    await act(async () => resolve(report));
    expect(replay).toHaveFocus();
    expect(screen.getByRole('button', { name: '■ 停止回放' })).toBeVisible();
    fireEvent.click(screen.getByText('錄音選項')); click('刪除錄音');
    expect(screen.getByRole('button', { name: '🎤 錄音並檢查' })).toHaveFocus();
    expect(view.container.querySelector('audio')).toBeNull();
  });
  it.each(['Desktop Chrome', 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile'])('checks the exact replayable clip once, only after finishing (%s)', async userAgent => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    const view = setup();
    expect(media.getUserMedia).not.toHaveBeenCalled(); expect(assessRecording).not.toHaveBeenCalled();
    expect(screen.getByText(/錄音會傳給 Google Gemini/)).toBeVisible();
    expect(screen.queryByText('只錄音回聽')).not.toBeInTheDocument();
    expect(screen.queryByText('只做文字比對')).not.toBeInTheDocument();
    await begin();
    expect(assessRecording).not.toHaveBeenCalled();
    await finish();
    expect(view.recognition).not.toHaveBeenCalled();
    expect(media.tracks[0].stop).toHaveBeenCalled();
    expect(assessRecording).toHaveBeenCalledExactlyOnceWith({ blob: media.createObjectURL.mock.calls[0][0], apiKey: 'test', signal: expect.any(AbortSignal) });
    expect(view.deps.compareWords).toHaveBeenCalledExactlyOnceWith(card.en, card.en);
    expect(screen.getByRole('heading', { name: '這次說得很棒！' })).toHaveFocus();
    expect(screen.getByText('這次練好了，可以繼續囉！')).toBeVisible();
    expect(screen.getByRole('button', { name: '完成', exact: true })).toHaveClass('practice-primary');
    expect(view.props.onXp).toHaveBeenCalledOnce();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByText(/文字符合度/)).not.toBeVisible();
    fireEvent.click(screen.getByText('給大人看：這次的練習紀錄'));
    expect(screen.getByText(/文字符合度 100%/)).toBeVisible();
    const audio = view.container.querySelector('audio'); expect(audio.src).toBe('blob:voice-1');
    click('▶ 聽我的錄音'); click('🔊 和示範比較');
    expect(audio.pause).toHaveBeenCalled();
    expect(view.deps.speak).toHaveBeenLastCalledWith(card.en, 'en-US', .85, expect.any(Object));
    const speech = view.deps.speak.mock.lastCall[3]; act(() => { speech.onstart(); speech.onboundary({ charIndex: 7 }); });
    expect(view.container.querySelector('.is-current')).toHaveTextContent('drink');
    click('▶ 聽我的錄音'); expect(view.container.querySelector('.is-current')).toBeNull();
    expect(assessRecording).toHaveBeenCalledOnce();
    click('完成'); expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    expect(view.container.querySelector('audio')).toBeNull();
  });
  it('gives one short action, reads it in Chinese and plays only the word to practise', async () => {
    assessRecording.mockResolvedValue({ ...report, transcript: 'Please drink water.', delivery: 'practice', tip: 'join_words' });
    const view = setup(); await begin(); await finish();
    expect(screen.getByText('我們先練「more」，再說一次。')).toBeVisible();
    expect(screen.getByRole('button', { name: '🎤 再說一次', exact: true })).toHaveClass('practice-primary');
    const feedback = screen.getByRole('region', { name: '這次錄音的小提示' });
    expect(feedback.querySelectorAll('.recording-child-tip')).toHaveLength(1);
    expect(within(feedback).queryByText('發音清晰度')).not.toBeInTheDocument();
    click('🔊 聽小提示');
    expect(view.deps.speak).toHaveBeenLastCalledWith('有聽到你，繼續加油！我們先練「more」，再說一次。', 'zh-TW', .85, expect.any(Object));
    click('♫ 跟著唸'); expect(view.deps.speak).toHaveBeenLastCalledWith('more', 'en-US', .65, expect.any(Object));
    expect(view.props.onXp).not.toHaveBeenCalled();
    click('完成'); expect(screen.getByRole('region', { name: '口說練習完成' })).toBeVisible();
  });
  it('keeps a no-key recording local and requires a click to check after setup', async () => {
    const view = setup({ apiKey: '' }); await begin('🎤 開始錄音'); await finish();
    expect(assessRecording).not.toHaveBeenCalled(); expect(view.props.onXp).not.toHaveBeenCalled();
    expect(screen.getByText('請大人開啟語音小幫手，就能幫你檢查。')).toBeVisible();
    click('請大人幫忙設定'); expect(view.props.onOpenSettings).toHaveBeenCalledOnce();
    view.rerender(<StrictMode><SpeakingStudio {...view.props} apiKey="new-key" /></StrictMode>);
    expect(assessRecording).not.toHaveBeenCalled();
    await act(async () => click('檢查這段錄音'));
    expect(assessRecording.mock.calls[0][0].apiKey).toBe('new-key');
    expect(media.getUserMedia).toHaveBeenCalledOnce();
  });
  it('does not score silence or fabricate encouragement about pronunciation', async () => {
    assessRecording.mockResolvedValue({ speechDetected: false });
    const view = setup(); await begin(); await finish();
    expect(screen.getByRole('heading', { name: '這次還沒聽清楚' })).toBeVisible();
    expect(view.props.onXp).not.toHaveBeenCalled(); expect(view.deps.compareWords).not.toHaveBeenCalled();
    expect(screen.queryByText(/文字符合度/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▶ 聽我的錄音' })).toBeEnabled();
  });
  it('retries a failed check with the same recording and hides technical errors from children', async () => {
    assessRecording.mockRejectedValueOnce({ kind: 'limited' });
    const view = setup(); await begin(); await finish();
    expect(screen.getByRole('alert')).toHaveTextContent('錄音還在，可以再檢查一次');
    expect(screen.getByText(/目前達到使用限制/)).not.toBeVisible();
    await act(async () => click('再檢查一次'));
    expect(assessRecording).toHaveBeenCalledTimes(2);
    expect(assessRecording.mock.calls[0][0].blob).toBe(assessRecording.mock.calls[1][0].blob);
    expect(media.getUserMedia).toHaveBeenCalledOnce(); expect(view.props.onXp).toHaveBeenCalledOnce();
  });
  it.each(['刪除錄音', '先跳過這題 →', '🎤 再說一次', 'Ⅱ 先休息一下', '返回', 'hide', 'unmount'])('ignores late checks after %s', async action => {
    let resolve; assessRecording.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = setup(); await begin(); await finish();
    const signal = assessRecording.mock.calls[0][0].signal;
    await act(async () => {
      if (action === 'unmount') view.unmount();
      else if (action === 'hide') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); fireEvent(document, new Event('visibilitychange')); }
      else { if (action === '刪除錄音') fireEvent.click(screen.getByText('錄音選項')); click(action); }
    });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(report));
    expect(view.props.onXp).not.toHaveBeenCalled();
    expect(screen.queryByText('這次說得很棒！')).not.toBeInTheDocument();
  });
  it('clears old feedback when rerecording and never rewards the same item twice', async () => {
    const view = setup(); await begin(); await finish();
    await begin('🎤 再說一次');
    expect(screen.queryByText('這次說得很棒！')).not.toBeInTheDocument();
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    await finish();
    expect(assessRecording.mock.calls[1][0].blob).not.toBe(assessRecording.mock.calls[0][0].blob);
    expect(view.props.onXp).toHaveBeenCalledOnce();
    view.unmount();
    const resumed = setup(); expect(media.getUserMedia).toHaveBeenCalledTimes(2); expect(assessRecording).toHaveBeenCalledTimes(2);
    click('完成'); expect(resumed.props.onXp).not.toHaveBeenCalled();
  });
  it('keeps demos out of the way while the microphone is pending and releases a late stream on cancel', async () => {
    let resolve; media.getUserMedia.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    setup(); const track = { stop: vi.fn() };
    await begin(); expect(screen.queryByRole('button', { name: '🔊 聽示範' })).not.toBeInTheDocument(); click('取消這次錄音'); click('🔊 聽示範');
    await act(async () => resolve({ getTracks: () => [track] }));
    expect(track.stop).toHaveBeenCalled(); expect(assessRecording).not.toHaveBeenCalled();
  });
  it('handles rejected playback and keeps the completed check', async () => {
    setup(); await begin(); await finish();
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error('blocked'));
    await act(async () => click('▶ 聽我的錄音'));
    expect(screen.getByRole('alert')).toHaveTextContent('錄音暫時無法播放');
    click('▶ 聽我的錄音'); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('這次說得很棒！')).toBeVisible(); expect(assessRecording).toHaveBeenCalledOnce();
  });
  it('recovers from denied permission without uploading or awarding', async () => {
    media.getUserMedia.mockRejectedValueOnce({ name: 'NotAllowedError' });
    const view = setup(); await begin();
    expect(screen.getByRole('alert')).toHaveTextContent('麥克風尚未獲得允許');
    expect(screen.getByRole('button', { name: '🎤 錄音並檢查' })).toBeEnabled();
    expect(assessRecording).not.toHaveBeenCalled(); expect(view.props.onXp).not.toHaveBeenCalled();
  });
});
