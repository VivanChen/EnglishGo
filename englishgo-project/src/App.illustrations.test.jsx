import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(() => vi.restoreAllMocks());

it('keeps the GIF on the front and uses only storybook illustrations after revealing an elementary card', async () => {
  window.history.replaceState({}, '', '/?word=under&lv=elementary');
  localStorage.setItem('eg_quiet', 'true');
  localStorage.setItem('eg_gifkey', JSON.stringify('illustration-test-key'));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { images: { fixed_height_small: { url: 'https://media.giphy.com/under-illustration-test.gif' } } } }) });
  render(<App/>);
  const front = await screen.findByTestId('srs-front-media', {}, { timeout: 10000 });
  await waitFor(() => expect(within(front).getByRole('img')).toHaveAttribute('src', 'https://media.giphy.com/under-illustration-test.gif'));
  expect(screen.queryByTestId('srs-back-illustrations')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '點卡片看答案' }));
  expect(screen.getByTestId('srs-back-illustrations')).toBeInTheDocument();
  expect(within(screen.getByTestId('srs-back-illustrations')).getAllByRole('img')).toHaveLength(2);
  expect(document.querySelector('img[src*="media.giphy.com"]')).toBeNull();
  expect(screen.queryByTestId('srs-back-media')).not.toBeInTheDocument();
  fireEvent.keyDown(window, { code: 'Space', key: ' ' });
  expect(screen.queryByTestId('srs-back-illustrations')).not.toBeInTheDocument();
  expect(within(screen.getByTestId('srs-front-media')).getByRole('img')).toHaveAttribute('src', 'https://media.giphy.com/under-illustration-test.gif');
});
