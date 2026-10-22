import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceRecording } from './useVoiceRecording.js';
import { mockVoiceRecording } from '../test/voiceRecordingMock.js';

let media;
beforeEach(() => { media = mockVoiceRecording(); });
afterEach(() => { cleanup(); media.restore(); vi.useRealTimers(); });
const setup = () => renderHook(useVoiceRecording, { wrapper: StrictMode });
const begin = async (view, ready = vi.fn(), stopped = vi.fn()) => { await act(async () => view.result.current.start(ready, stopped)); return { ready, stopped }; };

describe('temporary voice recordings', () => {
  it('only requests audio after a gesture and builds a playable clip from final data, without autoplay or persistence', async () => {
    const view = setup();
    expect(media.getUserMedia).not.toHaveBeenCalled();
    const { ready, stopped } = await begin(view);
    expect(media.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(ready).toHaveBeenCalledOnce();
    expect(view.result.current.phase).toBe('listening');
    act(() => view.result.current.stop());
    expect(media.tracks[0].stop).toHaveBeenCalled();
    expect(view.result.current.clip).toBeNull();
    expect(view.result.current.phase).toBe('processing');
    act(() => media.instances[0].finish());
    expect(view.result.current.phase).toBe('idle');
    expect(view.result.current.clip.url).toBe('blob:voice-1');
    expect(media.createObjectURL.mock.calls[0][0].type).toBe('audio/mp4');
    expect(stopped).toHaveBeenCalledOnce();
    expect(localStorage.length).toBe(0);
    view.unmount();
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
  });
  it.each(['cancel', 'unmount', 'timeout'])('releases a late permission stream after %s without recording', async action => {
    vi.useFakeTimers();
    let resolve;
    media.getUserMedia.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = setup(), ready = vi.fn(), track = { stop: vi.fn() };
    act(() => view.result.current.start(ready));
    if (action === 'unmount') view.unmount();
    else act(() => action === 'cancel' ? view.result.current.cancel() : vi.advanceTimersByTime(25000));
    await act(async () => resolve({ getTracks: () => [track] }));
    expect(track.stop).toHaveBeenCalledOnce();
    expect(ready).not.toHaveBeenCalled();
    expect(media.instances).toHaveLength(0);
  });
  it('ignores cancelled recorder callbacks and revokes the old clip on rerecord', async () => {
    const view = setup();
    await begin(view);
    act(() => { view.result.current.stop(); media.instances[0].finish(); });
    await begin(view);
    expect(media.revokeObjectURL).toHaveBeenCalledWith('blob:voice-1');
    expect(view.result.current.clip).toBeNull();
    const stale = media.instances[1].onstop;
    act(() => view.result.current.cancel());
    act(() => stale());
    expect(media.createObjectURL).toHaveBeenCalledOnce();
    expect(media.tracks[1].stop).toHaveBeenCalled();
  });
  it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError'])('recovers from %s without starting recognition', async name => {
    media.getUserMedia.mockRejectedValueOnce({ name });
    const view = setup(), { ready } = await begin(view);
    expect(view.result.current.phase).toBe('idle');
    expect(view.result.current.error).not.toBe('');
    expect(ready).not.toHaveBeenCalled();
    await begin(view);
    expect(view.result.current.phase).toBe('listening');
    expect(view.result.current.error).toBe('');
  });
  it('automatically stops after 30 seconds and can recover if the final stop event never arrives', async () => {
    vi.useFakeTimers();
    const view = setup(), { stopped } = await begin(view);
    act(() => vi.advanceTimersByTime(30000));
    expect(media.instances[0].stop).toHaveBeenCalledOnce();
    expect(media.tracks[0].stop).toHaveBeenCalled();
    expect(stopped).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(4000));
    expect(view.result.current.phase).toBe('idle');
    expect(view.result.current.error).toContain('重新錄');
    expect(stopped).toHaveBeenCalledOnce();
  });
  it('reports empty and interrupted recordings without creating broken playback URLs', async () => {
    const view = setup();
    await begin(view);
    act(() => { view.result.current.stop(); media.instances[0].finish(new Blob()); });
    expect(view.result.current.error).toContain('沒有留下');
    await begin(view);
    act(() => media.instances[1].onerror());
    expect(view.result.current.error).toContain('錄音中斷');
    expect(media.tracks[1].stop).toHaveBeenCalled();
    expect(media.createObjectURL).not.toHaveBeenCalled();
  });
  it('releases the stream when recorder construction fails', async () => {
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: class { constructor() { throw new Error('unsupported'); } } });
    const view = setup();
    await begin(view);
    expect(media.tracks[0].stop).toHaveBeenCalled();
    expect(view.result.current.phase).toBe('idle');
  });
});
