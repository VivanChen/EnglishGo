// The model selects an observation; the app supplies short child-friendly copy.
import { storyWords } from '../lib/speechTiming.js';

export const recordingTips = ['keep_going', 'slow_down', 'speak_up', 'join_words', 'finish_word', 'listen_again'];

// Always practise the wording in the exercise, even if the transcript differs.
export function recordingPracticeFocus(target, suggested, preferredIndex = -1) {
  const words = storyWords(target), focus = storyWords(suggested || '');
  const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = index => index >= 0 && focus.length > 0 && focus.every((word, i) => normalize(word.text) && normalize(words[index + i]?.text || '') === normalize(word.text));
  const index = matches(preferredIndex) ? preferredIndex : words.findIndex((_, i) => matches(i));
  return index < 0 ? { focus: target, wordOffset: 0 } : {
    focus: target.slice(words[index].start, words[index + focus.length - 1].end), wordOffset: index,
  };
}

export function recordingFeedback(report, comparison, target, threshold = 80) {
  const missingIndex = comparison?.result?.findIndex(word => !word.ok) ?? -1;
  const missing = comparison?.result?.[missingIndex]?.word;
  const practice = recordingPracticeFocus(target, missing || report.focus, missingIndex);
  if (missing) return { title: '有聽到你，繼續加油！', tip: '先練這個字，再試一次。', retryTip: '把這個字一起說出來。', ...practice };
  const readyToContinue = comparison?.pct >= threshold && report.delivery === 'clear' && report.tip === 'keep_going';
  const tips = {
    keep_going: '跟著示範，再順順地說一次。',
    slow_down: '慢一點說，每個字都說清楚。',
    speak_up: '靠近麥克風一點，再說一次。',
    join_words: '把這幾個字接起來，順順地說。',
    finish_word: '聽聽最後的聲音，跟著唸一次。',
    listen_again: '先聽一次，再跟著慢慢唸。',
  };
  return {
    title: comparison?.pct >= threshold && report.delivery === 'clear' ? '這次說得很棒！' : '有聽到你，繼續加油！',
    tip: readyToContinue ? '這次練好了，可以繼續囉！' : tips[report.tip] || tips.listen_again,
    retryTip: tips[report.tip] || tips.listen_again,
    readyToContinue,
    ...practice,
  };
}
