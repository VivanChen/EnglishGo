import { afterEach, expect, it, vi } from 'vitest';
import { assessRecording, readRecordingAssessment } from './recordingAssessmentService.js';

afterEach(() => vi.unstubAllGlobals());
const report = { speechDetected: true, transcript: 'I drink water.', delivery: 'clear', tip: 'keep_going', focus: 'water' };
const response = value => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }) });
it('sends actual recorded bytes and MIME type, without giving the model a target sentence to copy', async () => {
  const fetch = vi.fn().mockResolvedValue(response(report)); vi.stubGlobal('fetch', fetch);
  const result = await assessRecording({ blob: new Blob(['recorded voice'], { type: 'audio/webm;codecs=opus' }), apiKey: 'private-test-key' });
  expect(result).toEqual(report);
  const [url, options] = fetch.mock.calls[0];
  expect(url).not.toContain('private-test-key');
  expect(options.headers['x-goog-api-key']).toBe('private-test-key');
  const body = JSON.parse(options.body), parts = body.contents[0].parts;
  expect(parts[1].inlineData).toEqual({ mimeType: 'audio/webm', data: btoa('recorded voice') });
  expect(parts[0].text).toContain('不要修正文法、補字');
  expect(parts[0].text).not.toContain('Please drink more water');
  expect(body.generationConfig.responseMimeType).toBe('application/json');
  expect(localStorage.length).toBe(0);
});
it('treats silence as unassessed and rejects invented or incomplete result shapes', () => {
  expect(readRecordingAssessment({ speechDetected: false, transcript: 'fake words' })).toEqual({ speechDetected: false });
  for (const invalid of [{}, { ...report, speechDetected: 'true' }, { ...report, transcript: '' }, { ...report, delivery: null }, { ...report, tip: "long complicated explanation" }, { ...report, transcript: 'a'.repeat(1201) }]) {
    expect(() => readRecordingAssessment(invalid)).toThrow();
  }
});
it('does not send recordings without a key, with unsupported data, or after cancellation', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const blob = new Blob(['voice'], { type: 'audio/mp4' });
  await expect(assessRecording({ blob, apiKey: '' })).rejects.toMatchObject({ kind: 'auth' });
  await expect(assessRecording({ blob: new Blob(['text']), apiKey: 'test' })).rejects.toMatchObject({ kind: 'request' });
  const controller = new AbortController(); controller.abort();
  await expect(assessRecording({ blob, apiKey: 'test', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).not.toHaveBeenCalled();
});
it('does not retry rate limits or expose provider diagnostics', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { code: 429, message: 'private-test-key' } }) }); vi.stubGlobal('fetch', fetch);
  await expect(assessRecording({ blob: new Blob(['voice'], { type: 'audio/mp4' }), apiKey: 'test' })).rejects.toMatchObject({ kind: 'limited' });
  expect(fetch).toHaveBeenCalledOnce();
});
it('tries the configured fallback after malformed model output', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response({ speechDetected: true })).mockResolvedValueOnce(response(report)); vi.stubGlobal('fetch', fetch);
  await expect(assessRecording({ blob: new Blob(['voice'], { type: 'audio/mp4' }), apiKey: 'test' })).resolves.toEqual(report);
  expect(fetch).toHaveBeenCalledTimes(2);
});
