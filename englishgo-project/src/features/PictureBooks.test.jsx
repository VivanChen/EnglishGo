import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PictureBooks from './PictureBooks.jsx';
import { PICTURE_BOOKS, validatePictureBookProgress } from '../data/pictureBooks.js';

vi.mock('../components/PictureBookStage.jsx', () => ({ default: () => <div data-testid="three-stage"/> }));

function setup() {
  const props = { onBack: vi.fn(), onXp: vi.fn(), speak: vi.fn(() => ({})), stopSpeech: vi.fn() };
  const view = render(<PictureBooks {...props}/>);
  fireEvent.click(screen.getByRole('button', { name: /小狐狸找星星/ }));
  return { ...props, ...view };
}
describe('interactive picture books', () => {
  it('animates every letter, highlights real voice boundaries and advances continuous reading only after audio ends', () => {
    vi.useFakeTimers();
    try {
      const props = setup();
      expect(document.querySelectorAll('.pb-letter')).toHaveLength(PICTURE_BOOKS[0].pages[0].en.replace(/\s/g, '').length);
      fireEvent.click(screen.getByRole('button', { name:'♫ 整本讀給我聽' }));
      const first = props.speak.mock.calls.at(-1)[3];
      expect(document.querySelector('.is-speaking')).toBeNull();
      act(() => { first.onstart(); first.onboundary({name:'word',charIndex:9}); });
      expect(screen.getByRole('button', {name:'朗讀單字 fox'})).toHaveAttribute('aria-current','true');
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.getByLabelText(PICTURE_BOOKS[0].pages[0].en)).toBeVisible();
      act(() => first.onend());
      act(() => vi.advanceTimersByTime(800));
      expect(screen.getByLabelText(PICTURE_BOOKS[0].pages[1].en)).toBeVisible();
      expect(props.speak.mock.calls.at(-1)[0]).toBe(PICTURE_BOOKS[0].pages[1].en);
      const second = props.speak.mock.calls.at(-1)[3];
      fireEvent.click(screen.getByRole('button', {name:'第 4 頁'}));
      act(() => { second.onstart(); second.onend(); vi.advanceTimersByTime(1000); });
      expect(screen.getByLabelText(PICTURE_BOOKS[0].pages[3].en)).toBeVisible();
      expect(screen.getByRole('button', { name:'♫ 整本讀給我聽' })).toHaveAttribute('aria-pressed','false');
      props.unmount();
    } finally { vi.useRealTimers(); }
  });
  it('aligns bilingual content, scene targets and quiz answers', () => {
    for (const book of PICTURE_BOOKS) {
      expect(book.pages).toHaveLength(4);
      expect(book.quiz.options[book.quiz.answer]).toBeTruthy();
      for (const page of book.pages) {
        expect(page.en).toMatch(/[.!?]$/);
        expect(page.zh).toMatch(/[\u4e00-\u9fff]/);
        expect(page.objects.filter(o => o.word === page.target)).toHaveLength(1);
        expect(new Set(page.objects.map(o => o.word)).size).toBe(page.objects.length);
      }
    }
  });
  it('reveals Chinese, pronounces objects, saves progress and resumes', () => {
    const props = setup();
    expect(screen.queryByText(PICTURE_BOOKS[0].pages[0].zh)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '顯示中文' }));
    expect(screen.getByText(PICTURE_BOOKS[0].pages[0].zh)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '探索 fox' }));
    expect(screen.getByText('這是 fox（狐狸）。再找找 moon！')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '探索 moon' }));
    expect(props.speak).toHaveBeenLastCalledWith('moon', 'en-US', 0.8, expect.any(Object));
    fireEvent.click(screen.getByRole('button', { name: '下一頁 →' }));
    props.unmount();
    setup();
    expect(screen.getByLabelText(PICTURE_BOOKS[0].pages[1].en)).toBeVisible();
    expect(JSON.parse(localStorage.getItem('eg_pictureBooks_v1'))['little-light'].found).toEqual([0]);
  });
  it('requires all exploration tasks, allows quiz retries and awards completion only once', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: '第 4 頁' }));
    expect(screen.queryByRole('button', { name: 'A rabbit', exact: true })).not.toBeInTheDocument();
    for (const [i, page] of PICTURE_BOOKS[0].pages.entries()) {
      fireEvent.click(screen.getByRole('button', { name: `第 ${i + 1} 頁` }));
      fireEvent.click(screen.getByRole('button', { name: `探索 ${page.target}` }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'A fish', exact: true }));
    expect(props.onXp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'A rabbit', exact: true }));
    expect(props.onXp).toHaveBeenCalledExactlyOnceWith(20);
    fireEvent.click(screen.getByRole('button', { name: '← 童書書架' }));
    fireEvent.click(screen.getByRole('button', { name: /小狐狸找星星/ }));
    fireEvent.click(screen.getByRole('button', { name: 'A rabbit', exact: true }));
    expect(props.onXp).toHaveBeenCalledTimes(1);
  });
  it('handles corrupt storage and unavailable audio, and stops on exit', () => {
    localStorage.setItem('eg_pictureBooks_v1', '{invalid');
    const props = setup();
    props.speak.mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: '▶ 聽這一頁' }));
    expect(screen.getByRole('alert')).toHaveTextContent('目前無法朗讀');
    props.unmount();
    expect(props.stopSpeech).toHaveBeenCalled();
    expect(validatePictureBookProgress({ 'little-light': { page: 999, found: [-1, 0, 0, 2, 8], completed: 'yes' } })).toEqual({ 'little-light': { page: 3, found: [0, 2], completed: false } });
  });
});
