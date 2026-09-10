import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import App from './App.jsx';

function openApp() {
  render(<App/>);
  fireEvent.click(screen.getByText('Elementary', { exact: true }));
}

function offerInstall(prompt, outcome = 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });
  act(() => window.dispatchEvent(event));
  return event;
}

it('consumes a dismissed install prompt and accepts a fresh browser offer', async () => {
  openApp();
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = offerInstall(prompt);
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '安裝', exact: true }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '安裝', exact: true })).toBeNull());
  expect(prompt).toHaveBeenCalledTimes(1);
  offerInstall(vi.fn().mockResolvedValue(undefined));
  expect(screen.getByRole('button', { name: '安裝', exact: true })).toBeInTheDocument();
});

it('handles a rejected install call and explains the browser-menu fallback', async () => {
  openApp();
  offerInstall(vi.fn().mockRejectedValue(new Error('Install prompt unavailable')));
  fireEvent.click(screen.getByRole('button', { name: '安裝', exact: true }));
  expect(await screen.findByText(/暫時無法開啟安裝視窗/)).toHaveAttribute('role', 'status');
  expect(screen.queryByRole('button', { name: '安裝', exact: true })).toBeNull();
});

it('does not reuse an install event while the browser dialog is pending', async () => {
  openApp();
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const prompt = vi.fn().mockReturnValue(pending);
  offerInstall(prompt);
  const button = screen.getByRole('button', { name: '安裝', exact: true });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(prompt).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); await pending; });
});

it('clears the banner when installation completes through browser controls', () => {
  openApp();
  offerInstall(vi.fn());
  act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(screen.queryByRole('button', { name: '安裝', exact: true })).toBeNull();
});
