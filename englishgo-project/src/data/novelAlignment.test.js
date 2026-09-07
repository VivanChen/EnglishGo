import { describe, expect, it } from 'vitest';
import { NOVELS } from './novels.js';
import { novelBlocks, novelBlockPairs } from './novelAudio.js';

const forest = NOVELS.elementary[0];
const tower = NOVELS.junior[0];
const counts = {
  [forest.id]: [71, 66, 94, 105, 151, 173, 165, 124],
  [tower.id]: [120, 181, 151, 162, 159, 170, 160, 146, 164, 157, 158, 150, 186, 169, 166, 104],
};

describe('all published bilingual novels', () => {
  for (const novels of Object.values(NOVELS)) for (const novel of novels) for (const chapter of novel.chapters) {
    it(`${novel.id} chapter ${chapter.no} preserves every original English paragraph with a translation`, () => {
      const en = novelBlocks(chapter.en), zh = novelBlocks(chapter.zh);
      expect(en.length).toBe(counts[novel.id][chapter.no - 1]);
      expect(zh).toHaveLength(en.length);
      expect(en.every(text => text.trim())).toBe(true);
      expect(zh.every(text => text.trim())).toBe(true);
      const pairs = novelBlockPairs(chapter.en, chapter.zh);
      expect(pairs.map(block => block.en)).toEqual(en);
      expect(pairs.map(block => block.zh)).toEqual(zh);
    });
  }

  it.each([
    ['Long sentence.\n\nA.\n\nB.', '長句。\n\n甲。'],
    ['A.\n\nB.', '甲。\n\n乙。\n\n丙。'],
    ['A.', ''],
    ['', '甲。'],
  ])('rejects missing or surplus translations without guessing a merge', (en, zh) => {
    expect(() => novelBlockPairs(en, zh, 'test book, chapter 7')).toThrow(/Unaligned test book, chapter 7/);
  });

  it('keeps intentional line breaks, comma endings, and repeated short paragraphs', () => {
    expect(novelBlockPairs('It was still a shadow,\n\nbut now it had light inside.\n\nNear.\n\nNear.', '它仍是影子，\n\n但裡面有光。\n\n靠近。\n\n靠近。')).toHaveLength(4);
    expect(novelBlockPairs('SEAL THE GATE\nOR\nOPEN THE PRISON\n\nChoose.', '封閉大門\n或者\n打開監獄\n\n選擇。')[0]).toEqual({ en: 'SEAL THE GATE\nOR\nOPEN THE PRISON', zh: '封閉大門\n或者\n打開監獄', i: 0 });
    expect(novelBlockPairs(undefined, undefined)).toEqual([]);
  });
});

// These reviewed passages catch semantic drift even when both sides have equal counts.
describe('reviewed translation boundaries', () => {
  it.each([
    [forest, 4, 58, [
      ['Lily reached in.', '莉莉把手伸進去。'],
      ['She pulled out another piece.', '她拿出了另一塊碎片。'],
      ['It was the second Moon Key piece.', '那是第二塊月之鑰匙。'],
      ['Coco clapped.', '可可拍手。'],
    ]],
    [forest, 6, 46, [
      ['One circle had a star pattern.', '一個圓形裡有星星圖案。'],
      ['One had a moon pattern.', '另一個有月亮圖案。'],
      ['One had a spiral pattern.', '還有一個有螺旋圖案。'],
      ['Lily remembered the Whispering Stones.', '莉莉想起低語之石。'],
    ]],
    [forest, 6, 128, [
      ['But now—', '但現在——'],
      ['It looked more solid.', '它看起來更有實體了。'],
      ['More real.', '更真實。'],
      ['Stronger than before.', '更強。'],
    ]],
    [forest, 7, 23, [
      ['Lily stepped closer.', '莉莉又走近了一步。'],
      ['She raised her hand slowly.', '她慢慢舉起手。'],
      ['The moment she touched it—', '就在她碰到水晶的那一刻——'],
      ['Flash!', '閃光！'],
      ['A bright light filled her eyes.', '耀眼的光充滿了她的視野。'],
      ['Lily gasped.', '莉莉驚呼了一聲。'],
      ['She saw something.', '她看見了什麼。'],
      ['Not the cave.', '不是洞穴。'],
      ['Not the forest.', '不是森林。'],
      ['A memory.', '是一段記憶。'],
      ['Long ago—', '很久以前——'],
      ['The forest was brighter.', '森林更明亮。'],
      ['The trees were taller.', '樹更高。'],
    ]],
    [forest, 7, 38, [
      ['And in the center—', '而在中央——'],
      ['The Star Crystal shined even stronger.', '星之水晶發出更強的光。'],
      ['But then—', '但——'],
    ]],
    [forest, 7, 102, [
      ['Instead—', '反而——'],
      ['It grew even stronger.', '它變得更強了。'],
    ]],
    [forest, 7, 140, [
      ['It looked weak.', '看起來虛弱。'],
      ['Sad.', '難過。'],
      ['Lonely.', '孤單。'],
    ]],
    [forest, 7, 153, [
      ['The small shadow did not disappear.', '小影子沒有消失。'],
      ['It stayed.', '它留了下來。'],
      ['But now—', '但現在——'],
      ['It was calm.', '它很平靜。'],
      ['The darkness was gone.', '黑暗消失了。'],
    ]],
    [forest, 8, 20, [
      ['It moved through the forest.', '它穿過森林。'],
      ['Far and wide.', '傳向四面八方。'],
      ['Trees began to shine again.', '樹再次發光。'],
    ]],
    [tower, 13, 17, [
      ['A terrible sound.', '那是可怕的聲音。'],
      ['Ancient.', '古老。'],
      ['Hungry.', '飢餓。'],
    ]],
    [tower, 13, 145, [
      ['Because it felt real.', '因為那感覺很真實。'],
      ['Too real.', '太真實了。'],
      ['Then Daniel’s expression became serious again.', '接著丹尼爾表情再次變嚴肅。'],
    ]],
    [tower, 14, 110, [
      ['Closer.', '更近了。'],
      ['Closer.', '更近了。'],
      ['Ethan closed his eyes tightly.', '伊森緊緊閉上雙眼。'],
      ['He remembered his grandmother.', '他想起奶奶。'],
      ['His father.', '他的父親。'],
      ['The train.', '那班列車。'],
      ['His first day at the school.', '他在學校的第一天。'],
      ['Then he remembered something else.', '接著，他又想起另一件事。'],
    ]],
    [tower, 16, 55, [['A silver flame surrounded by a clock circle.', '一道銀色火焰，周圍環繞著時鐘圓環。']]],
  ].map(([novel, no, start, expected]) => ({ novel, no, start, expected })))('$novel.id chapter $no paragraph $start matches meaning across the whole passage', ({ novel, no, start, expected }) => {
    const chapter = novel.chapters.find(ch => ch.no === no);
    const pairs = novelBlockPairs(chapter.en, chapter.zh);
    expect(pairs.slice(start - 1, start - 1 + expected.length).map(({ en, zh }) => [en, zh])).toEqual(expected);
  });
});
