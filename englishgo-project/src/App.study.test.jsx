import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
const get = key => JSON.parse(localStorage.getItem(`eg_${key}`));
const set = (key, value) => localStorage.setItem(`eg_${key}`, JSON.stringify(value));
afterEach(() => vi.useRealTimers());
describe('learning history integration', () => {
  it('archives a day once under StrictMode and awards consecutive learning only after practice', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 6, 12));
    const yesterday = new Date(2026, 8, 5).toDateString();
    set('daily', { date: yesterday, done: 5, target: 5 }); set('streak', 2); set('hist', [{ date: yesterday, done: 5, target: 5 }]); set('quiet', true);
    const view = render(<StrictMode><App /></StrictMode>); fireEvent.click(screen.getByText('Elementary').closest('button'));
    await waitFor(() => expect(get('daily')).toMatchObject({ done: 0, target: 5 }));
    expect(get('streak')).toBe(3); expect(get('hist')).toHaveLength(1); expect(get('ach')).not.toContain('streak3');
    fireEvent.click(await screen.findByRole('button', { name: '開始 5 張單字小任務' }));
    fireEvent.click(await screen.findByRole('button', { name: '點卡片看答案' }, { timeout: 5000 })); fireEvent.click(screen.getByRole('button', { name: /記住了/ }));
    await waitFor(() => expect(get('ach').filter(id => id === 'streak3')).toHaveLength(1)); expect(get('daily').done).toBe(1);
    view.unmount();
  });
  it('rolls an open page on the next local day, preserves the target and earned badges, and shows today in the report', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 6, 23, 55));
    set('daily', { date: new Date().toDateString(), done: 4, target: 5 }); set('streak', 7); set('ach', ['streak7']);
    const view = render(<App />); fireEvent.click(screen.getByText('Elementary').closest('button'));
    await screen.findByRole('button', { name: '開始 5 張單字小任務' });
    act(() => { vi.setSystemTime(new Date(2026, 8, 8, 9)); window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(get('daily')).toMatchObject({ date: new Date().toDateString(), done: 0, target: 5 }));
    expect(get('streak')).toBe(1); expect(get('hist')).toHaveLength(1); expect(get('hist')[0].done).toBe(4); expect(get('ach')).toContain('streak7');
    fireEvent.click(document.querySelector('[data-group-id="tools"]')); fireEvent.click(document.querySelector('[data-module-id="dashboard"]'));
    expect(await screen.findByRole('button', { name: '9/8，今天，0 步' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9/6，4 步' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '今天的小目標' })).toHaveAttribute('max', '5'); view.unmount();
  });
});
