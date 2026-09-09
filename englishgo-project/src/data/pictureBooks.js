// Original EnglishGo stories. Each page pairs one sentence with its translation and scene task.
const item = (word, zh, icon, x, y) => ({ word, zh, icon, x, y });
export const PICTURE_BOOKS = [
  {
    id: 'little-light', title: 'A Little Light', zh: '小狐狸找星星', icon: '🦊', theme: 'night', level: '入門 · A1', description: '跟著小狐狸，發現夜晚裡溫柔的光。',
    pages: [
      { en: 'A little fox looks up at the moon.', zh: '一隻小狐狸抬頭望著月亮。', prompt: '找到照亮夜空的 moon。', target: 'moon', objects: [item('fox', '狐狸', '🦊', 28, 70), item('moon', '月亮', '🌙', 77, 23), item('tree', '樹', '🌲', 77, 68)] },
      { en: 'A small star falls beside a flower.', zh: '一顆小星星落在花朵旁邊。', prompt: '小星星掉下來了！找到 star。', target: 'star', objects: [item('star', '星星', '⭐', 56, 65), item('flower', '花朵', '🌼', 78, 71), item('fox', '狐狸', '🦊', 24, 70)] },
      { en: 'The fox and a rabbit help the star.', zh: '狐狸和一隻兔子一起幫助星星。', prompt: '誰來幫忙了？找到 rabbit。', target: 'rabbit', objects: [item('fox', '狐狸', '🦊', 22, 68), item('rabbit', '兔子', '🐰', 76, 68), item('star', '星星', '⭐', 50, 58)] },
      { en: 'The star shines above their home.', zh: '星星在牠們的家上方閃耀。', prompt: '朋友回家了，找到 home。', target: 'home', objects: [item('star', '星星', '⭐', 50, 23), item('home', '家', '🏡', 70, 65), item('fox', '狐狸', '🦊', 25, 72)] },
    ],
    quiz: { question: 'Who helps the fox save the star?', zh: '誰和狐狸一起幫助星星？', options: ['A rabbit', 'A fish', 'A bird'], answer: 0, explanation: 'The fox and a rabbit help the star. 狐狸和兔子一起幫忙。' },
  },
  {
    id: 'picnic', title: 'A Picnic for Everyone', zh: '一起去野餐', icon: '🐻', theme: 'day', level: '入門 · A1', description: '帶上水果和好朋友，練習分享的英文。',
    pages: [
      { en: 'Bear puts an apple in the basket.', zh: '小熊把一顆蘋果放進籃子裡。', prompt: '帶什麼去野餐呢？找到 apple。', target: 'apple', objects: [item('bear', '熊', '🐻', 23, 67), item('apple', '蘋果', '🍎', 52, 54), item('basket', '籃子', '🧺', 77, 73)] },
      { en: 'A bird sings in the tree.', zh: '一隻小鳥在樹上唱歌。', prompt: '聽，是誰在唱歌？找到 bird。', target: 'bird', objects: [item('bird', '鳥', '🐦', 71, 33), item('tree', '樹', '🌳', 74, 67), item('bear', '熊', '🐻', 25, 72)] },
      { en: 'Bear shares bread with a rabbit.', zh: '小熊和一隻兔子分享麵包。', prompt: '大家一起吃，找到 bread。', target: 'bread', objects: [item('bear', '熊', '🐻', 22, 67), item('bread', '麵包', '🍞', 51, 67), item('rabbit', '兔子', '🐰', 79, 68)] },
      { en: 'The friends sit under a rainbow.', zh: '朋友們坐在彩虹下。', prompt: '野餐的驚喜！找到 rainbow。', target: 'rainbow', objects: [item('rainbow', '彩虹', '🌈', 50, 26), item('bear', '熊', '🐻', 23, 71), item('rabbit', '兔子', '🐰', 75, 72)] },
    ],
    quiz: { question: 'What does Bear share with the rabbit?', zh: '小熊和兔子分享了什麼？', options: ['A flower', 'Bread', 'A star'], answer: 1, explanation: 'Bear shares bread with a rabbit. 小熊和兔子分享麵包。' },
  },
];

export function validatePictureBookProgress(value) {
  const clean = {};
  for (const book of PICTURE_BOOKS) {
    const saved = value?.[book.id];
    if (!saved || typeof saved !== 'object') continue;
    clean[book.id] = { page: Number.isInteger(saved.page) ? Math.max(0, Math.min(book.pages.length - 1, saved.page)) : 0, found: Array.isArray(saved.found) ? [...new Set(saved.found.filter(i => Number.isInteger(i) && i >= 0 && i < book.pages.length))] : [], completed: saved.completed === true };
  }
  return clean;
}
