import { vi } from 'vitest';

export function mockVoiceRecording() {
  const instances = [], tracks = [];
  class Recorder {
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/mp4'; instances.push(this); }
    start = vi.fn(() => { this.state = 'recording'; queueMicrotask(() => this.onstart?.()); });
    stop = vi.fn(() => { this.state = 'inactive'; });
    finish(data = new Blob(['voice'], { type: this.mimeType })) { this.ondataavailable?.({ data }); this.onstop?.(); }
  }
  const getUserMedia = vi.fn(async () => {
    const track = { stop: vi.fn() }; tracks.push(track);
    return { getTracks: () => [track] };
  });
  let next = 0;
  const createObjectURL = vi.fn(() => `blob:voice-${++next}`), revokeObjectURL = vi.fn();
  const originals = [
    [globalThis, 'MediaRecorder'], [navigator, 'mediaDevices'], [URL, 'createObjectURL'], [URL, 'revokeObjectURL'],
  ].map(([object, key]) => [object, key, Object.getOwnPropertyDescriptor(object, key)]);
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  return { instances, tracks, getUserMedia, createObjectURL, revokeObjectURL,
    restore: () => originals.forEach(([object, key, descriptor]) => { if (descriptor) Object.defineProperty(object, key, descriptor); else delete object[key]; }),
  };
}
