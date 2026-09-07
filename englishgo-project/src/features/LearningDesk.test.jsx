import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WordExplorer from './WordExplorer.jsx';
import TutorStudio from './TutorStudio.jsx';
const Hdr = ({ t, onBack }) => <header><h1>{t}</h1><button onClick={onBack}>返回</button></header>;
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const change = (name, value) => fireEvent.change(screen.getByRole('textbox', { name, exact: true }), { target: { value } });
const store = key => JSON.parse(localStorage.getItem(key));
const word = { w: 'apple', m: '蘋果', level: 'elementary', ex: 'An apple falls from the tree.', ez: '一顆蘋果從樹上掉下來。' };
const query = '查詢英文或中文單字', input = '想問什麼，或想試著回答什麼？';
const settle = (fn, value) => act(async () => fn(value));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function explorer(extra = {}) {
  const deps = { Hdr, c: { l: '小學' }, levels: { elementary: { l: '小學' }, junior: { l: '國中' } }, searchCloudWords: vi.fn().mockResolvedValue([]), searchAnyWords: vi.fn().mockResolvedValue([word]), mergeWordResults: words => [...new Map(words.map(w => [w.w, w])).values()], speakWebSpeech: vi.fn().mockReturnValue({}), stopSpeech: vi.fn(), ...extra };
  const props = { lv: 'elementary', deps, onBack: vi.fn(), onOpenCard: vi.fn(), onReviewCards: vi.fn() };
  return { ...render(<StrictMode><WordExplorer {...props} /></StrictMode>), props, deps };
}
function tutor(extra = {}, overrides = {}) {
  const deps = { Hdr, c: { l: '小學', en: 'Elementary' }, speakMx: vi.fn().mockReturnValue({}), stopSpeech: vi.fn(), ask: vi.fn().mockResolvedValue('**apple** 是蘋果。'), ...extra };
  const props = { lv: 'elementary', apiKey: 'test-key', onBack: vi.fn(), onOpenSettings: vi.fn(), onOpenPractice: vi.fn(), deps, ...overrides };
  return { ...render(<StrictMode><TutorStudio {...props} /></StrictMode>), props, deps };
}
describe('word explorer', () => {
  it('shows local results before a slow cloud response and ignores stale searches immediately on edit', async () => {
    let resolve; const view = explorer({ searchCloudWords: vi.fn(() => new Promise(r => { resolve = r; })), searchAnyWords: vi.fn(async (lv, q) => q === 'apple' ? [word] : []) });
    change(query, 'apple'); click('搜尋'); await screen.findByRole('button', { name: '看看 apple 的意思與例句' });
    expect(screen.getByText(/正在找單字/)).toBeInTheDocument(); change(query, 'book'); await settle(resolve, [{ ...word, w: 'late' }]);
    expect(screen.queryByRole('button', { name: /看看 late/ })).not.toBeInTheDocument(); view.unmount();
  });
  it('saves authored examples, restores details and collection, and starts a collection deck', async () => {
    const view = explorer(); change(query, 'apple'); click('搜尋'); click(await screen.findByRole('button', { name: '看看 apple 的意思與例句' }).then(button => button.getAttribute('aria-label')));
    expect(screen.getByText(word.ez)).toBeInTheDocument(); click('♫ 聽例句'); expect(view.deps.speakWebSpeech.mock.calls.at(-1)[0]).toBe(word.ex);
    click('收藏這個字'); click('大字閱讀'); view.unmount(); const next = explorer(); expect(screen.getByText(word.ex)).toBeInTheDocument(); expect(screen.getByRole('button', { name: '大字閱讀' })).toHaveAttribute('aria-pressed', 'true');
    click('我的收藏 · 1'); click('用收藏練 5 張單字卡'); expect(next.props.onReviewCards).toHaveBeenCalledWith([word]);
    click('移出收藏 apple'); expect(store('eg_word_explorer_elementary').favorites).toHaveLength(0); click('還原收藏'); expect(store('eg_word_explorer_elementary').favorites).toHaveLength(1);
  });
  it('supports stopping a search, retrying the same example, and no-result recovery', async () => {
    const view = explorer({ searchAnyWords: vi.fn().mockResolvedValue([]) }); change(query, 'apple'); click('搜尋'); await screen.findByText('還沒找到這個單字');
    view.deps.searchAnyWords.mockResolvedValue([word]); click('試試 apple'); await screen.findByRole('button', { name: '看看 apple 的意思與例句' });
    view.deps.searchCloudWords.mockImplementation(() => new Promise(() => {})); click('搜尋'); await screen.findByText(/正在找單字/); click('停止查詢'); expect(screen.queryByText(/正在找單字/)).not.toBeInTheDocument(); expect(screen.getByRole('textbox', { name: query })).toHaveValue('apple');
  });
});
describe('tutor studio', () => {
  it('previews prompts, saves draft without a key, and keeps Enter and IME composition from sending', () => {
    const view = tutor({}, { apiKey: '' }); click(/短句上手/);
    expect(view.deps.ask).not.toHaveBeenCalled(); expect(screen.getByRole('textbox', { name: input }).value).toContain('小學程度'); click('送出問題 →'); expect(screen.getByText(/你寫的問題已保留/)).toBeInTheDocument();
    click('請大人設定 AI'); expect(view.props.onOpenSettings).toHaveBeenCalledOnce(); view.unmount();
    const next = tutor(); const box = screen.getByRole('textbox', { name: input }); fireEvent.keyDown(box, { key: 'Enter' }); fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true, isComposing: true }); expect(next.deps.ask).not.toHaveBeenCalled();
  });
  it('ignores a cancelled answer even after another workbook has received a new answer', async () => {
    const resolvers = []; const view = tutor({ ask: vi.fn(() => new Promise(resolve => resolvers.push(resolve))) });
    change(input, 'first'); click('送出問題 →'); await waitFor(() => expect(resolvers).toHaveLength(1)); click('停止回答'); click('開一本新練習簿'); change(input, 'second'); click('送出問題 →'); await waitFor(() => expect(resolvers).toHaveLength(2));
    await settle(resolvers[1], 'new answer'); await settle(resolvers[0], 'old answer'); expect(screen.getByText('new answer')).toBeInTheDocument(); expect(screen.queryByText('old answer')).not.toBeInTheDocument();
    const book = store('eg_tutor_studio_elementary'); expect(book.sessions[1].turns[0].status).toBe('stopped'); expect(book.sessions[0].turns).toHaveLength(1); view.unmount();
  });
  it('retries a failed question once, excluding error text, and preserves responses on remount', async () => {
    const view = tutor({ ask: vi.fn().mockRejectedValueOnce(new Error('503 raw internal detail')).mockResolvedValue('A useful answer') }); change(input, 'question'); click('送出問題 →'); await screen.findByRole('button', { name: '重試這個問題' });
    expect(screen.queryByText(/raw internal/)).not.toBeInTheDocument(); click('重試這個問題'); await screen.findByText('A useful answer');
    expect(view.deps.ask.mock.calls[1][0].contents).toEqual([{ role: 'user', parts: [{ text: 'question' }] }]); click('收藏這段回答'); view.unmount();
    const next = tutor(); expect(within(screen.getByLabelText('這本練習簿的對話')).getByText('A useful answer')).toBeInTheDocument(); expect(screen.getByRole('button', { name: '已收藏這段' })).toBeDisabled(); expect(next.deps.ask).not.toHaveBeenCalled();
  });
  it('restores pending requests as stopped without auto-sending or losing a next draft', async () => {
    const view = tutor({ ask: () => new Promise(() => {}) }); change(input, 'pending'); click('送出問題 →'); change(input, 'next question'); view.unmount(); const next = tutor();
    expect(screen.getByText('這次回答已停止，問題還在。')).toBeInTheDocument(); expect(screen.getByRole('textbox', { name: input })).toHaveValue('next question'); expect(next.deps.ask).not.toHaveBeenCalled();
  });
  it('supports deleting and restoring workbooks and does not falsely claim copying succeeded', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); const view = tutor(); change(input, 'keep this'); click('送出問題 →'); await screen.findByText('是蘋果。'); click('複製回答');
    expect(screen.getByText(/目前無法自動複製/)).toBeInTheDocument(); click('朗讀回答'); expect(screen.getByRole('button', { name: '停止朗讀' })).toBeInTheDocument(); act(() => view.deps.speakMx.mock.calls.at(-1)[2].onend()); expect(screen.queryByRole('button', { name: '停止朗讀' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('我的練習簿 · 1 / 8')); click('移除練習簿 keep this'); click('還原剛才移除'); expect(store('eg_tutor_studio_elementary').sessions.some(session => session.title === 'keep this')).toBe(true);
  });
});
