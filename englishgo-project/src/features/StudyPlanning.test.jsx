import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExamPlanner from './ExamPlanner.jsx';
import AchievementGarden from './AchievementGarden.jsx';
import ProgressJournal from './ProgressJournal.jsx';
const Hdr = ({ t, onBack }) => <header><h1>{t}</h1><button onClick={onBack}>返回</button></header>;
const definitions = [{ id: 'first', name: '第一枚', desc: '完成一輪', metric: 'srsRounds', target: 1, unit: '輪', module: 'srs', group: 'learn', action: '練單字', icon: '🌟' }, { id: 'quiz', name: '答題紀念', desc: '答對題目', metric: 'perfectQuiz', target: 1, unit: '次', module: 'quiz', group: 'learn', action: '去答題', icon: '⭐' }];
const button = name => screen.getByRole('button', { name, exact: true });
const click = name => fireEvent.click(button(name));
const write = (name, value) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
const saved = () => JSON.parse(localStorage.getItem('eg_exam_planner_elementary'));
function exam(extra = {}) {
  const deps = { Hdr, c: { cl: '#507364' }, useLS: (key, initial) => useState(initial), terms: [['elementary-1a', '小一上']], counts: [5, 10], defaultTerm: () => 'elementary-1a', generateWords: vi.fn().mockResolvedValue(['book']), fetchCloudWord: vi.fn().mockResolvedValue(null), findAnyWord: vi.fn(async (lv, word) => word === 'unknown' ? null : { w: word, m: `字義 ${word}`, ex: 'Authored example.' }), orderCards: cards => [...cards].reverse(), ...extra };
  const props = { lv: 'elementary', onBack: vi.fn(), onStart: vi.fn(), apiKey: 'test', deps };
  return { ...render(<StrictMode><ExamPlanner {...props} /></StrictMode>), props, deps };
}
describe('exam planner', () => {
  it('requires meaning review, excludes unknown words, and starts a short checked selection once', async () => {
    const { props } = exam(); write('這次要練的英文單字', 'apple book cat dog run sun unknown'); click('先確認單字與字義 →');
    await screen.findByText('這次想練哪幾個？'); expect(screen.getByRole('checkbox', { name: /unknown/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /apple/ })); click('開始這輪複習'); click('開始這輪複習');
    expect(props.onStart).toHaveBeenCalledTimes(1); const cards = props.onStart.mock.calls[0][0].cards;
    expect(cards).toHaveLength(5); expect(cards.some(card => ['unknown', 'apple'].includes(card.w))).toBe(false);
  });
  it('lets an adult supply missing meaning and restores reviewed choices after remount', async () => {
    const view = exam(); write('這次要練的英文單字', 'unknown apple'); click('先確認單字與字義 →'); await screen.findByText('這次想練哪幾個？');
    write('請大人幫忙填寫「unknown」的字義', '未知的'); click('存下 unknown 的字義'); fireEvent.click(screen.getByRole('checkbox', { name: /apple/ }));
    expect(saved().review.cards[0]).toMatchObject({ m: '未知的', ex: '', source: '自填字義' }); view.unmount();
    const next = exam(); click('繼續上次整理 →'); expect(screen.getByRole('checkbox', { name: /unknown/ })).toBeChecked(); expect(screen.getByRole('checkbox', { name: /apple/ })).not.toBeChecked();
    click('開始這輪複習'); expect(next.props.onStart.mock.calls[0][0].cards).toHaveLength(1);
  });
  it('saves named lists, switches drafts, and supports undo after removing a saved list', () => {
    exam(); write('這次要練的英文單字', 'apple book'); write('範圍名稱', '星期五'); click('收藏這份範圍'); click('準備另一份範圍');
    write('這次要練的英文單字', 'dog'); fireEvent.click(screen.getByText('已收藏的範圍 · 1 / 12')); click(/^星期五/);
    expect(screen.getByRole('textbox', { name: '這次要練的英文單字' })).toHaveValue('apple book'); click('移除收藏 星期五'); expect(saved().lists).toHaveLength(0); click('還原'); expect(saved().lists).toHaveLength(1);
    expect(button('更新這份收藏')).toBeVisible(); click('更新這份收藏'); expect(saved().lists).toHaveLength(1);
  });
  it('restores the reviewed draft and selections when undoing a fresh range', async () => {
    exam(); write('這次要練的英文單字', 'apple book'); write('範圍名稱', '小考'); click('先確認單字與字義 →'); await screen.findByText('這次想練哪幾個？');
    fireEvent.click(screen.getByRole('checkbox', { name: /apple/ })); click('收藏這份範圍'); click('準備另一份範圍'); click('還原');
    expect(screen.getByRole('textbox', { name: '範圍名稱' })).toHaveValue('小考'); click('繼續上次整理 →');
    expect(screen.getByRole('checkbox', { name: /apple/ })).not.toBeChecked(); expect(button('更新這份收藏')).toBeVisible();
  });
  it('does not apply AI suggestions until chosen and ignores results after editing the draft', async () => {
    let resolve; const view = exam({ generateWords: vi.fn(() => new Promise(r => { resolve = r; })) });
    write('這次要練的英文單字', 'apple'); fireEvent.click(screen.getByText('還沒有範圍？看看 AI 單字建議')); click('AI 產生單字');
    await act(async () => resolve(['book'])); expect(screen.getByRole('textbox', { name: '這次要練的英文單字' })).toHaveValue('apple'); click('加入目前範圍'); expect(saved().text).toBe('apple\nbook');
    click('AI 產生單字'); write('這次要練的英文單字', 'teacher'); await act(async () => resolve(['late'])); expect(saved().text).toBe('teacher'); expect(screen.queryByRole('button', { name: '用這份建議' })).not.toBeInTheDocument(); view.unmount();
  });
  it('cancels a pending lookup without navigating or losing the input', async () => {
    const view = exam({ fetchCloudWord: () => new Promise(() => {}) }); write('這次要練的英文單字', 'apple'); click('先確認單字與字義 →'); click('停止整理');
    await act(async () => {}); expect(view.props.onStart).not.toHaveBeenCalled(); expect(saved().text).toBe('apple'); expect(button('先確認單字與字義 →')).toBeEnabled();
  });
});
describe('progress journal and badges', () => {
  it('shows live daily history and routes grade-specific review and copy fallback', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const onOpen = vi.fn(), onQuickStart = vi.fn();
    render(<ProgressJournal lv="elementary" xp={105} streak={1} stats={{ srsRounds: 3 }} daily={{ date: new Date().toDateString(), done: 4, target: 10 }} history={[]} weakWords={[{ w: 'apple', n: 2, level: 'elementary' }, { w: 'station', n: 5, level: 'junior' }]} achUnlocked={['first']} onOpen={onOpen} onQuickStart={onQuickStart} deps={{ Hdr, c: {}, definitions, levelName: '小學', shareLine: vi.fn() }} />);
    expect(screen.getByRole('button', { name: /今天，4 步/ })).toBeInTheDocument(); expect(screen.queryByText('station')).not.toBeInTheDocument(); click('看看複習清單'); expect(onOpen).toHaveBeenCalledWith('weak', 'tools');
    click('開始 5 張單字小任務'); expect(onQuickStart).toHaveBeenCalled(); fireEvent.click(screen.getByText('把進步給家人看看')); click('複製學習紀錄');
    expect(await screen.findByText('目前無法自動複製，可以選取下面的紀錄文字。')).toBeInTheDocument(); expect(screen.getByRole('textbox').value).toContain('今天的小目標：4 / 10 步');
  });
  it('filters badges, preserves earned ones, and persists a chosen display badge', () => {
    const props = { unlocked: ['first', 'quiz'], values: {}, onBack: vi.fn(), onOpen: vi.fn(), onQuickStart: vi.fn(), deps: { Hdr, c: {}, definitions } };
    const view = render(<AchievementGarden {...props} />); click('答題紀念，已收藏'); click('展示這枚徽章'); expect(JSON.parse(localStorage.getItem('eg_featured_badge'))).toBe('quiz'); view.unmount();
    render(<AchievementGarden {...props} />); expect(document.querySelector('.badge-featured')).toHaveTextContent('答題紀念'); click('還在路上 · 0'); expect(screen.getByText('這裡的目標都完成了')).toBeInTheDocument();
  });
});
