import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HereWeGoBrowser from './HereWeGoBrowser.jsx';
import { getHereWeGoCards } from '../data/hanlinHereWeGoWords.js';

describe('Here We Go vocabulary browser', () => {
  it('searches bilingual words and starts exactly the visible search scope', () => {
    const onStart = vi.fn();
    render(<HereWeGoBrowser onStart={onStart}/>);
    fireEvent.click(screen.getByText('依範圍挑字練習／預覽單字'));
    fireEvent.change(screen.getByLabelText('搜尋 Here We Go 單字'), { target: { value: '蘋果' } });
    expect(screen.getByRole('status')).toHaveTextContent('找到 1 個字詞，本輪練 1 張');
    expect(screen.getByText('apple')).toBeVisible();
    fireEvent.click(screen.getByText('例句與來源'));
    expect(screen.getByText('I put an apple in my bag.')).toBeVisible();
    expect(screen.getByRole('link', { name: '查看公開來源 ↗' })).toHaveAttribute('href', expect.stringContaining('https://'));
    fireEvent.click(screen.getByRole('button', { name: '練習目前範圍' }));
    expect(getHereWeGoCards(onStart.mock.calls[0][0]).map(card => card.w)).toEqual(['apple']);
    fireEvent.change(screen.getByLabelText('搜尋 Here We Go 單字'), { target: { value: '沒有這個字詞' } });
    expect(screen.getByRole('button', { name: '練習目前範圍' })).toBeDisabled();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('resets pagination when scope changes and keeps names separate', () => {
    render(<HereWeGoBrowser onStart={vi.fn()}/>);
    fireEvent.click(screen.getByText('依範圍挑字練習／預覽單字'));
    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    expect(screen.getByRole('button', { name: '上一頁' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Here We Go 練習範圍'), { target: { value: 'names' } });
    const list = screen.getByRole('list');
    expect(within(list).getByText('Abu')).toBeVisible();
    expect(within(list).queryByText('one')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    fireEvent.change(screen.getByLabelText('Here We Go 冊次'), { target: { value: 'hanlin-here-we-go-8' } });
    expect(screen.getByRole('button', { name: '練習目前範圍' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Here We Go 練習範圍'), { target: { value: 'all' } });
    expect(screen.getByRole('button', { name: '上一頁' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('81 個字詞');
  });
});
