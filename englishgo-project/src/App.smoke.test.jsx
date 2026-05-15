import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

async function openElementaryMenu() {
  localStorage.setItem(
    'eg_loginBonus',
    JSON.stringify({ lastDate: new Date().toDateString(), streak: 1, claimed: true }),
  );

  render(<App />);

  const elementaryButton = screen.getByText('Elementary').closest('button');
  fireEvent.click(elementaryButton);

  await waitFor(() => {
    expect(screen.getByText('XP')).toBeInTheDocument();
  });
}

function clickFirstButtonWithText(text) {
  const target = screen.getAllByText(text).find(node => node.closest('button'));
  expect(target).toBeTruthy();
  fireEvent.click(target.closest('button'));
}

function clickMenuStat(label) {
  const labelNode = [...document.querySelectorAll('.eg-menu-stat-label')]
    .find(node => node.textContent.trim() === label);

  expect(labelNode).toBeTruthy();
  fireEvent.click(labelNode.closest('button'));
}

describe('EnglishGo app smoke flow', () => {
  it('renders the landing page', () => {
    render(<App />);

    expect(screen.getByText('EnglishGo')).toBeInTheDocument();
    expect(screen.getByText('Elementary')).toBeInTheDocument();
    expect(screen.getByText('Junior High')).toBeInTheDocument();
    expect(screen.getByText('Senior High')).toBeInTheDocument();
  });

  it('opens the main menu after selecting a level', async () => {
    await openElementaryMenu();
  });

  it('opens the lazy SRS module', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('單字卡');

    expect(await screen.findByText(/SRS 單字卡/)).toBeInTheDocument();
  });

  it('opens the lazy novel reader module', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    expect(await screen.findByText('The Secret Forest Adventure')).toBeInTheDocument();
  });

  it('opens the lazy gacha module from the coin stat', async () => {
    await openElementaryMenu();

    clickMenuStat('金幣');

    expect(await screen.findByText(/扭蛋機/, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('opens the lazy pet guard module from the pet stat', async () => {
    await openElementaryMenu();

    clickMenuStat('寵物');

    expect(await screen.findByText('歡迎來到寵物樂園！', {}, { timeout: 5000 })).toBeInTheDocument();
  }, 15000);
});
