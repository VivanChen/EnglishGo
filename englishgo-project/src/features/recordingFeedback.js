// The model selects an observation; the app supplies short child-friendly copy.
export const recordingTips = ['keep_going', 'slow_down', 'speak_up', 'join_words', 'finish_word', 'listen_again'];

export function recordingFeedback(report, comparison, target, threshold = 80) {
  const missing = comparison?.result?.find(word => !word.ok)?.word;
  const focus = missing || report.focus || target;
  if (missing) return { title: '有聽到你，繼續加油！', tip: `我們先練「${missing}」，再說一次。`, focus };
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
    tip: tips[report.tip] || tips.listen_again,
    focus,
  };
}
