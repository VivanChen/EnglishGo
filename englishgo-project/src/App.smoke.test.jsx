import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

async function openSeniorMenu(search = '/') {
  window.history.pushState({}, '', search);
  localStorage.setItem(
    'eg_loginBonus',
    JSON.stringify({ lastDate: new Date().toDateString(), streak: 1, claimed: true }),
  );

  render(<App />);

  const seniorButton = screen.getByText('Senior High').closest('button');
  fireEvent.click(seniorButton);

  await waitFor(() => {
    expect(screen.getByText('XP')).toBeInTheDocument();
  });
}

function clickFirstModuleCard() {
  const target = document.querySelector('.eg-menu-module');
  expect(target).toBeTruthy();
  fireEvent.click(target);
}

function setViewportWidth(width) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  });
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

  it('starts an exam-range SRS round from typed words', async () => {
    await openElementaryMenu();

    const examCard = document.querySelector('[data-module-id="exam"]');
    expect(examCard).toBeTruthy();
    fireEvent.click(examCard);

    expect(await screen.findByText(/考試範圍複習/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'apple school apple' } });
    expect(screen.getByText(/已合併\/忽略 1 筆/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('開始這輪複習'));

    expect(await screen.findByText(/SRS 單字卡/)).toBeInTheDocument();
    expect(await screen.findByText('考試範圍模式')).toBeInTheDocument();
    expect(screen.getByText('2 個單字')).toBeInTheDocument();
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
      expect(screen.getByLabelText('播放詞性變化 apples')).toBeInTheDocument();
      expect(screen.getByLabelText('播放搭配 eat an apple')).toBeInTheDocument();
      expect(screen.getByLabelText('播放例句 1')).toBeInTheDocument();
      expect(screen.getByLabelText('播放相似字 fruit')).toBeInTheDocument();
      expect(document.querySelector('iframe')).toBeNull();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('opens the lazy novel reader module', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    expect(await screen.findByText('The Secret Forest Adventure', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('shows improved novel reading navigation inside a chapter', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    fireEvent.click(await screen.findByText('The Whispering Tree', {}, { timeout: 5000 }));

    expect(await screen.findByText('閱讀控制台')).toBeInTheDocument();
    expect(screen.getByText('本頁進度')).toBeInTheDocument();
    expect(screen.getByText('章節概覽')).toBeInTheDocument();
    expect(screen.getByText('下一頁')).toBeInTheDocument();
  });

  it('resumes a novel from the last read page', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    fireEvent.click(await screen.findByText('The Whispering Tree', {}, { timeout: 5000 }));
    expect(await screen.findByText('閱讀控制台')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('章節列表'));

    expect(await screen.findByText('繼續閱讀')).toBeInTheDocument();
    expect(screen.getByText(/上次讀到 Chapter 1 · Page 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('繼續閱讀'));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
  });

  it('adjusts novel reading comfort settings', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    fireEvent.click(await screen.findByText('The Whispering Tree', {}, { timeout: 5000 }));

    expect(await screen.findByText('閱讀設定')).toBeInTheDocument();
    const paragraphs = await screen.findAllByTestId('novel-reader-text');
    expect(paragraphs[0]).toHaveStyle({ fontSize: '16px' });

    fireEvent.click(screen.getByRole('button', { name: 'A+' }));
    expect(paragraphs[0]).toHaveStyle({ fontSize: '18px' });

    fireEvent.click(screen.getByRole('button', { name: '寬行距' }));
    expect(paragraphs[0]).toHaveStyle({ lineHeight: '1.9' });

    fireEvent.click(screen.getByRole('button', { name: '專注模式' }));
    expect(screen.queryByText('閱讀控制台')).not.toBeInTheDocument();
  });

  it('uses a mobile-safe novel reader layout on narrow screens', async () => {
    setViewportWidth(390);
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    fireEvent.click(await screen.findByText('The Whispering Tree', {}, { timeout: 5000 }));

    expect(await screen.findByTestId('novel-chapter-hero')).toHaveStyle({ gridTemplateColumns: '1fr' });
    expect(screen.getByTestId('novel-reading-settings')).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
    expect(screen.getByTestId('novel-chapter-nav')).toHaveStyle({ gridTemplateColumns: '1fr 1fr' });

    setViewportWidth(1024);
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

  it('shows hidden timing calibration controls for songs', async () => {
    await openSeniorMenu('/?timing=1');

    const readTab = document.querySelector('[data-group-id="read"]');
    expect(readTab).toBeTruthy();
    fireEvent.click(readTab);

    const songsCard = document.querySelector('[data-module-id="songs"]');
    expect(songsCard).toBeTruthy();
    fireEvent.click(songsCard);

    expect(await screen.findByText('Taipei Cipher', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Timing Lab')).toBeInTheDocument();
    expect(screen.getByText('Export timings')).toBeInTheDocument();
    expect(screen.getAllByText('Set current').length).toBeGreaterThan(0);
  });
});
