import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

function clickFirstModuleCard() {
  const target = document.querySelector('.eg-menu-module');
  expect(target).toBeTruthy();
  fireEvent.click(target);
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

  it('opens unified API key settings from the tools menu', async () => {
    await openElementaryMenu();

    const toolsTab = document.querySelector('[data-group-id="tools"]');
    expect(toolsTab).toBeTruthy();
    fireEvent.click(toolsTab);

    const settingsCard = document.querySelector('[data-module-id="settings"]');
    expect(settingsCard).toBeTruthy();
    fireEvent.click(settingsCard);

    expect(await screen.findByText('API Key 設定')).toBeInTheDocument();
    expect(screen.getByText('Gemini API Key')).toBeInTheDocument();
    expect(screen.getByText('Giphy API Key')).toBeInTheDocument();
  });

  it('opens the lazy SRS module', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('單字卡');

    expect(await screen.findByText(/SRS 單字卡/)).toBeInTheDocument();
  });

  it('shows a Giphy GIF on SRS cards when a GIF key is configured', async () => {
    const gifUrl = 'https://media.giphy.com/media/englishgo-test.gif';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          images: {
            fixed_height_small: { url: gifUrl },
          },
        },
      }),
    });

    localStorage.setItem('eg_gifkey', JSON.stringify('test-key'));

    try {
      await openElementaryMenu();
      clickFirstModuleCard();

      expect(await screen.findByRole('heading', { name: /SRS/ })).toBeInTheDocument();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.giphy.com/v1/gifs/translate'));
      });

      await waitFor(() => {
        expect(document.querySelector(`img[src="${gifUrl}"]`)).toBeTruthy();
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('opens dictionary lookup results from the SRS card back', async () => {
    localStorage.removeItem('eg_gifkey');
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));
    localStorage.removeItem('kid_dict_elementary%3Aapple');

    await openElementaryMenu();
    clickFirstModuleCard();

    fireEvent.click(await screen.findByTestId('srs-card'));

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                word: 'apple',
                headlineZh: '蘋果',
                shortMeaning: '一種常見的水果。',
                kidExplanation: 'apple 是紅色、綠色或黃色的水果，可以直接吃。',
                partOfSpeechZh: '名詞',
                forms: [{ word: 'apples', note: '複數' }],
                collocations: [{ phrase: 'eat an apple', zh: '吃一顆蘋果' }],
                examples: [{ en: 'I eat an apple every day.', zh: '我每天吃一顆蘋果。' }],
                synonyms: [{ word: 'fruit', zh: '水果' }],
                tips: ['apple 前面常用 an。'],
              }),
            }],
          },
        }],
      }),
    });

    try {
      fireEvent.click(await screen.findByText('🔎 查字典'));

      expect(await screen.findByRole('complementary', { name: 'Dictionary results' })).toBeInTheDocument();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.any(Object));
      });
      expect(await screen.findByText('小朋友版解釋')).toBeInTheDocument();
      expect(await screen.findByText(/一種常見的水果/)).toBeInTheDocument();
      expect(document.querySelector('iframe')).toBeNull();
    } finally {
      fetchMock.mockRestore();
    }
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
