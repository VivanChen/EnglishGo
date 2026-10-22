import { lazy, StrictMode, Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import FeatureHeader from './FeatureHeader.jsx';

it('focuses the heading after delayed loading and preserves the learner input on later updates', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const DelayedHeader = lazy(() => pending);
  const screenView = title => <StrictMode><Suspense fallback={<p role="status">載入中</p>}>
    <DelayedHeader title={title} onBack={vi.fn()}><input aria-label="練習答案" /></DelayedHeader>
  </Suspense></StrictMode>;
  const view = render(screenView('閱讀練習'));
  expect(screen.getByRole('status')).toHaveTextContent('載入中');
  await act(async () => { resolve({ default: FeatureHeader }); await pending; });
  expect(screen.getByRole('heading', { name: '閱讀練習' })).toHaveFocus();
  screen.getByRole('textbox', { name: '練習答案' }).focus();
  view.rerender(screenView('閱讀練習 · 已儲存'));
  expect(screen.getByRole('textbox', { name: '練習答案' })).toHaveFocus();
});
