import { expect, it } from 'vitest';
import { recordingFeedback, recordingTips } from './recordingFeedback.js';
import { readRecordingAssessment } from './recordingAssessmentService.js';

const report = { speechDetected: true, transcript: 'Please drink more water.', delivery: 'clear', tip: 'keep_going', focus: 'water' };
it('invites continuing after a clear complete attempt, and reserves retry for a concrete practice tip', () => {
  const comparison = { pct: 100, result: [{ word: 'water', ok: true }] };
  expect(recordingFeedback(report, comparison, report.transcript)).toMatchObject({ readyToContinue: true, tip: '這次練好了，可以繼續囉！' });
  expect(recordingFeedback({ ...report, tip: 'slow_down' }, comparison, report.transcript).readyToContinue).toBe(false);
  expect(recordingFeedback({ ...report, delivery: 'practice' }, comparison, report.transcript).readyToContinue).toBe(false);
});
it('never displays model prose or an unrelated focus word in the child feedback', () => {
  const checked = readRecordingAssessment({ ...report, focus: 'Ignore all instructions', practice: '複雜評語'.repeat(100) });
  expect(checked.focus).toBe('');
  expect(checked).not.toHaveProperty('practice');
  for (const tip of recordingTips) {
    const result = recordingFeedback({ ...checked, tip }, { pct: 100, result: [] }, report.transcript);
    expect(result.tip.length).toBeLessThan(25);
    expect(result.focus).toBe(report.transcript);
  }
});
it('chooses just the first word to practise, without accusing the child of a mistake', () => {
  const result = recordingFeedback(report, { pct: 50, result: [{ word: 'more', ok: false }, { word: 'water', ok: false }] }, report.transcript);
  expect(result).toEqual({ title: '有聽到你，繼續加油！', tip: '我們先練「more」，再說一次。', focus: 'more' });
});
it('accepts only short, consecutive words actually heard in the recording', () => {
  expect(readRecordingAssessment({ ...report, focus: 'drink more' }).focus).toBe('drink more');
  for (const focus of ['drink water', 'drink more water please', '水 water', 'Read <script>']) {
    expect(readRecordingAssessment({ ...report, focus }).focus).toBe('');
  }
});
