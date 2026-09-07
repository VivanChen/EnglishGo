import { StrictMode, useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NovelM from './NovelM.jsx';
import { NOVELS } from '../data/novels.js';
import { novelBlockPairs } from '../data/novelAudio.js';
import { BOOKMARK_LIMIT, resolveBookmarks } from './novelReading.js';

vi.mock('../components/NovelIllustration.jsx', () => ({ default: () => <div /> }));
const book = NOVELS.elementary[0], secondBook = NOVELS.junior[0];
function useLS(key, initial) {
  const [value, setValue] = useState(() => JSON.parse(localStorage.getItem(`eg_${key}`)) ?? initial);
  useEffect(() => { localStorage.setItem(`eg_${key}`, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}
const Hdr = ({ t, onBack }) => <header><h1>{t}</h1><button onClick={onBack}>返回</button></header>;
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
function mount(extra = {}) {
  const deps = { Hdr, useLS, LV: { elementary: { cl: '#0f6e56', bg: '#eef5ee', ac: '#528973' } }, S: { card: {}, btn: {}, t1: '#243e33', t2: '#435a50', t3: '#647369', bg1: '#fff', bg2: '#eef2ee', bd: '#c7d5cc' }, readingWords: value => value.split(/\s+/), playSound: vi.fn(), stopSpeech: vi.fn(), speak: vi.fn(() => ({})), speakStory: vi.fn(() => ({ cancel: vi.fn(), pause: () => true, resume: () => true })), ...extra };
  const props = { lv: 'elementary', onBack: vi.fn(), onXp: vi.fn(), deps };
  return { ...render(<StrictMode><NovelM {...props} /></StrictMode>), props, deps };
}
async function open() { fireEvent.click(await screen.findByTestId('novel-chapter-card-1')); await screen.findByTestId('novel-reader-panel'); }
function finishTurn() { const sheet = screen.queryByTestId('novel-page-turn'); if (sheet) fireEvent.animationEnd(sheet); }
function openAudio(){click('展開閱讀工具');click('聽故事');}
function openParagraph(index){click(`段落 ${index+1} 的閱讀工具`);}
function jumpLast() {
  click('☷ 目錄與書籤');
  const select = screen.getByRole('combobox', { name: '跳到頁面' });
  fireEvent.change(select, { target: { value: select.options[select.options.length - 1].value } }); finishTurn();
}
afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 }); Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 }); });

describe('novel reading continuity', () => {
  it('restores old chapter 7 progress and bookmarks, narrates the corrected pair, and does not migrate twice', async () => {
    localStorage.setItem('eg_novelReadingProgress', JSON.stringify({ [book.id]: { chapterNo: 7, blockIndex: 28, blockCount: 157, page: 14, pageCount: 79 } }));
    localStorage.setItem('eg_novelBookmarks', JSON.stringify({ [book.id]: [{ chapterNo: 7, blockIndex: 28, createdAt: 123 }] }));
    const view = mount(); await screen.findByText('繼續閱讀');
    expect(screen.getByText('Not the cave.')).toBeInTheDocument(); click('繼續閱讀');
    await screen.findByTestId('novel-reader-panel'); click('☷ 目錄與書籤'); click('前往書籤 第 7 章第 30 段');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-reader-block', '29'));
    const paragraph = document.activeElement;
    expect(within(paragraph).getByTestId('novel-reader-text')).toHaveTextContent('Not the cave.');
    expect(within(paragraph).getByTestId('novel-reader-translation')).toHaveTextContent('不是洞穴。');
    openParagraph(29);click('朗讀中文（固定真人聲線）');click('關閉工具面板');
    expect(view.deps.speak).toHaveBeenLastCalledWith('不是洞穴。', 'zh-TW', 1, expect.objectContaining({ audioUrl: expect.stringContaining('-zh-block-29-') }));
    openAudio();click('從這裡接著朗讀');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const items = view.deps.speakStory.mock.calls.at(-1)[0];
    const englishIndex = items.findIndex(item => item.text === 'Not the cave.');
    expect(items.slice(englishIndex, englishIndex + 2).map(item => [item.text, item.lang, item.blockIndex])).toEqual([['Not the cave.', 'en-US', 29], ['不是洞穴。', 'zh-TW', 29]]);
    openParagraph(29);click('取消收藏段落 30'); click('還原書籤');click('關閉工具面板');
    expect(JSON.parse(localStorage.getItem('eg_novelBookmarks'))[book.id][0]).toMatchObject({ blockIndex: 29, contentVersion: 2 });
    expect(JSON.parse(localStorage.getItem('eg_novelReadingProgress'))[book.id]).toMatchObject({ blockIndex: 29, blockCount: 165, contentVersion: 2 });
    view.unmount(); mount(); await screen.findByText('繼續閱讀');
    expect(screen.getByText('Not the cave.')).toBeInTheDocument();
    click('繼續閱讀'); click('☷ 目錄與書籤'); click('前往書籤 第 7 章第 30 段');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-reader-block', '29'));
  });
  it('uses a contained mobile reader in portrait and landscape, and releases the page on exit', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const view=mount(); await open();
    expect(document.documentElement).toHaveClass('novel-mobile-reading');
    expect(screen.queryByRole('button',{name:'章節列表',exact:true})).not.toBeInTheDocument();
    Object.defineProperty(window,'innerWidth',{configurable:true,value:844});
    Object.defineProperty(window,'innerHeight',{configurable:true,value:390});
    fireEvent(window,new Event('resize'));
    expect(document.documentElement).toHaveClass('novel-mobile-reading');
    click('返回章節列表');
    expect(document.documentElement).not.toHaveClass('novel-mobile-reading');
    await open(); view.unmount(); expect(document.documentElement).not.toHaveClass('novel-mobile-reading');
  });
  it('puts the mobile chapter quiz and completion in the page navigation', async () => {
    Object.defineProperty(window,'innerWidth',{configurable:true,value:390});
    const view=mount(); await open(); jumpLast();
    const actions=screen.getByTestId('novel-page-actions');
    fireEvent.click(within(actions).getByRole('button',{name:'故事小測驗'}));
    book.chapters[0].quiz.forEach(question=>click(question.o[question.a])); click('關閉工具面板');
    fireEvent.click(within(actions).getByRole('button',{name:'完成・下一章'}));
    expect(view.props.onXp).toHaveBeenCalledExactlyOnceWith(15);
    click('☷ 目錄與書籤');expect(screen.getByRole('combobox',{name:'跳到頁面'})).toHaveValue('0');
  });
  it('keeps a paragraph bookmark after font changes and a remount, and supports removal undo', async () => {
    const view = mount(); await open(); click('下一頁'); finishTurn();
    const paragraph = screen.getAllByTestId('novel-reader-text')[1];
    const index = Number(paragraph.closest('section').dataset.readerBlock), text = paragraph.textContent;
    openParagraph(index);click(`收藏段落 ${index + 1}`);click('關閉工具面板');click('閱讀偏好');click('A+');click('關閉工具面板');
    expect(screen.getAllByTestId('novel-reader-text').some(node => node.textContent === text)).toBe(true);
    expect(JSON.parse(localStorage.getItem('eg_novelReadingProgress'))[book.id].blockIndex).toBeGreaterThanOrEqual(0);
    view.unmount(); mount(); await open(); click('☷ 目錄與書籤');
    click(`前往書籤 第 1 章第 ${index + 1} 段`);
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-reader-block', String(index)));
    expect(screen.getAllByTestId('novel-reader-text').some(node => node.textContent === text)).toBe(true);
    openParagraph(index);click(`取消收藏段落 ${index + 1}`); click('還原書籤');
    expect(screen.getByRole('button', { name: `取消收藏段落 ${index + 1}` })).toHaveAttribute('aria-pressed', 'true');
  });
  it('persists translation and paper preferences but keeps paragraph peeks temporary', async () => {
    const view = mount(); await open(); click('閱讀偏好'); click('先讀英文'); click('夜讀'); click('清楚字體'); click('關閉工具面板');
    expect(screen.queryByTestId('novel-reader-translation')).not.toBeInTheDocument();
    openParagraph(0);click('看看段落 1 的中文');
    expect(screen.getAllByTestId('novel-reader-translation')).toHaveLength(1);
    expect(screen.getAllByTestId('novel-reader-text')[0]).toHaveStyle({ fontFamily: 'Arial, "Noto Sans", sans-serif' });
    expect(screen.getByTestId('novel-reader-panel')).toHaveStyle({ background: '#202e30' });
    view.unmount(); mount(); await open(); expect(screen.queryByTestId('novel-reader-translation')).not.toBeInTheDocument();
    expect(screen.getByTestId('novel-reader-panel')).toHaveStyle({ background: '#202e30' });
  });
  it('leaves text selection quiet and ignores arrow keys from a page control', async () => {
    const view = mount(); await open(); fireEvent.click(screen.getAllByTestId('novel-reader-text')[0]);
    expect(view.deps.speak).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: '段落 1 的閱讀工具' }), { key: 'ArrowRight' });
    expect(screen.queryByTestId('novel-page-turn')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('novel-reader-panel'), { key: 'ArrowRight' });
    expect(screen.getByTestId('novel-page-turn')).toBeInTheDocument(); finishTurn();
  });
  it('jumps across chapters without reusing the previous chapter text or saved page', async () => {
    mount(); await open(); jumpLast(); click('☷ 目錄與書籤');
    fireEvent.click(within(screen.getByRole('navigation', { name: '故事章節' })).getByRole('button', { name: new RegExp(book.chapters[1].title) }));
    await waitFor(() => expect(screen.getAllByTestId('novel-reader-text')[0]).toHaveTextContent(novelBlockPairs(book.chapters[1].en,book.chapters[1].zh)[0].en.replace(/\s+/g,' ')));
    click('☷ 目錄與書籤');expect(screen.getByRole('combobox', { name: '跳到頁面' })).toHaveValue('0');click('關閉工具面板');
    expect(screen.getAllByTestId('novel-reader-text').every(node => book.chapters[1].en.includes(node.textContent))).toBe(true);
  });
  it('restores the selected storybook after leaving the feature', async () => {
    NOVELS.elementary.push(secondBook);
    try {
      const view = mount(); await screen.findByTestId('novel-chapter-card-1'); click(secondBook.title); await open(); view.unmount(); mount();
      await screen.findByTestId('novel-chapter-card-1'); expect(JSON.parse(localStorage.getItem('eg_novelSelectedBooks')).elementary).toBe(secondBook.id); expect(screen.getByText('繼續閱讀')).toBeInTheDocument();
    } finally { NOVELS.elementary.pop(); }

  });
  it('offers the quiz at the final spread, allows correcting an answer, and rewards each chapter once', async () => {
    const view = mount(); await open(); jumpLast(); expect(screen.getByRole('button', { name: '故事小測驗' })).toBeInTheDocument();
    click('故事小測驗'); const first=book.chapters[0].quiz[0]; click(first.o.find((_,i)=>i!==first.a)); expect(screen.getByText(/再看看故事/)).toBeInTheDocument(); book.chapters[0].quiz.forEach(question=>click(question.o[question.a]));
    click('關閉工具面板'); click('完成・下一章'); expect(view.props.onXp).toHaveBeenCalledExactlyOnceWith(15);
    await waitFor(() => expect(screen.getAllByTestId('novel-reader-text')[0]).toHaveTextContent(novelBlockPairs(book.chapters[1].en,book.chapters[1].zh)[0].en.replace(/\s+/g,' ')));
    click('返回章節列表'); await open();jumpLast();click('完成・下一章'); expect(view.props.onXp).toHaveBeenCalledTimes(1);
  });
  it('restores keyboard focus on Escape and traps Tab in the mobile tools dialog', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    mount(); await open(); const opener = screen.getByRole('button', { name: '☷ 目錄與書籤' }); opener.focus(); click('☷ 目錄與書籤');
    const dialog = screen.getByRole('dialog', { name: '目錄與書籤' }), buttons = within(dialog).getAllByRole('button');
    expect(document.activeElement).toBe(buttons[0]); fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(buttons.at(-1));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('continues bilingual narration from the current spread instead of restarting the chapter', async () => {
    const view = mount(); await open(); click('下一頁'); finishTurn();
    const index=Number(screen.getAllByTestId('novel-reader-text')[0].closest('section').dataset.readerBlock);
    openAudio();click('從這裡接著朗讀');
    const items=view.deps.speakStory.mock.calls[0][0];
    expect(index).toBeGreaterThan(0); expect(items[0].blockIndex).toBe(index); expect(items[1].blockIndex).toBe(index);
    expect(items[0].lang).toBe('en-US'); expect(items[1].lang).toBe('zh-TW');
    expect(items.every(item=>item.blockIndex>=index)).toBe(true);
  });
  it('ignores old story callbacks after a new narration starts or the chapter changes', async () => {
    const options = [];
    const view = mount({ speakStory: vi.fn((items, opts) => { options.at(-1)?.oncancel?.(); options.push(opts); return { cancel: vi.fn() }; }) });
    await open();openAudio();click('整章朗讀');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();click('停止小說朗讀');click('英中本頁朗讀');
    act(() => { options[0].onFinish(); options[0].onSentence(0, '', { blockIndex: 29 }); });
    expect(screen.getByRole('button', { name: '停止小說朗讀' })).toBeInTheDocument(); expect(screen.queryByTestId('novel-page-turn')).not.toBeInTheDocument();
    click('返回章節列表'); await open(); act(() => options[1].onSentence(0, '', { blockIndex: 29 })); expect(screen.queryByTestId('novel-page-turn')).not.toBeInTheDocument();
    view.unmount(); expect(view.deps.stopSpeech).toHaveBeenCalled();
  });
});

it('resolves only unique valid bookmark locations against authored bilingual paragraphs', () => {
  const book = NOVELS.elementary[0];
  const result = resolveBookmarks(book, [null, { chapterNo: 9, blockIndex: 0 }, { chapterNo: 1, blockIndex: -1 }, { chapterNo: 1, blockIndex: 900 }, { chapterNo: 1, blockIndex: 1 }, { chapterNo: 1, blockIndex: 1 }]);
  expect(result).toHaveLength(1); expect(result[0].block).toMatchObject({ en: novelBlockPairs(book.chapters[0].en,book.chapters[0].zh)[1].en, zh: novelBlockPairs(book.chapters[0].en,book.chapters[0].zh)[1].zh });
  expect(resolveBookmarks(book, {})).toEqual([]); expect(result.length).toBeLessThanOrEqual(BOOKMARK_LIMIT);
});
