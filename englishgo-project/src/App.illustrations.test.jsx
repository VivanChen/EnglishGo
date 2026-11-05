import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(() => vi.restoreAllMocks());

it('keeps storybook art on the front, after reveal, and after flipping back', async () => {
  window.history.replaceState({}, '', '/?word=under&lv=elementary');
  localStorage.setItem('eg_quiet', 'true');
  render(<App/>);
  const front = await screen.findByTestId('srs-front-media', {}, { timeout: 10000 });
  await waitFor(() => expect(within(front).getByRole('img')).toHaveAttribute('src', expect.stringContaining('/elementary/under-')));
  const frontImage = within(front).getByRole('img').getAttribute('src');
  expect(screen.queryByTestId('srs-back-illustrations')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '點卡片看答案' }));
  expect(screen.getByTestId('srs-back-illustrations')).toBeInTheDocument();
  expect(within(screen.getByTestId('srs-back-illustrations')).getAllByRole('img')).toHaveLength(2);
  expect(screen.queryByTestId('srs-back-media')).not.toBeInTheDocument();
  fireEvent.keyDown(window, { code: 'Space', key: ' ' });
  expect(screen.queryByTestId('srs-back-illustrations')).not.toBeInTheDocument();
  expect(within(screen.getByTestId('srs-front-media')).getByRole('img')).toHaveAttribute('src', frontImage);
});
