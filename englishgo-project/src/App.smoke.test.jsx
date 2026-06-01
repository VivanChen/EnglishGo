import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

async function openJuniorMenu() {
  localStorage.setItem(
    'eg_loginBonus',
    JSON.stringify({ lastDate: new Date().toDateString(), streak: 1, claimed: true }),
  );

  render(<App />);

  const juniorButton = screen.getByText('Junior High').closest('button');
  fireEvent.click(juniorButton);

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

function installMockSpeechRecognition() {
  const OriginalSpeechRecognition = window.SpeechRecognition;
  const OriginalWebkitSpeechRecognition = window.webkitSpeechRecognition;
  class MockSpeechRecognition {
    constructor() {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.continuous = false;
    }
    start() {}
    stop() {}
    abort() {}
  }
  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
  return () => {
    window.SpeechRecognition = OriginalSpeechRecognition;
    window.webkitSpeechRecognition = OriginalWebkitSpeechRecognition;
  };
}

describe('EnglishGo app smoke flow', () => {
  it('renders the landing page', () => {
    render(<App />);

    expect(screen.getByText('EnglishGo')).toBeInTheDocument();
    expect(screen.getByText('Elementary')).toBeInTheDocument();
    expect(screen.getByText('Junior High')).toBeInTheDocument();
    expect(screen.getByText('Senior High')).toBeInTheDocument();
    expect(screen.getByText('近期新增')).toBeInTheDocument();
    expect(screen.getByText('高中歌曲新增')).toBeInTheDocument();
    expect(screen.getByText('國中歌曲新增')).toBeInTheDocument();
    expect(screen.queryByText('查看 GitHub 更新')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 小朋友字典')).not.toBeInTheDocument();
  });

  it('opens a recent feature inside the app', async () => {
    render(<App />);

    const seniorSongCard = screen.getByText('高中歌曲新增').closest('button');
    expect(seniorSongCard).toBeTruthy();
    fireEvent.click(seniorSongCard);

    expect(await screen.findByText('Taipei Cipher', {}, { timeout: 5000 })).toBeInTheDocument();
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

  it('opens AI tutor with polished practice starters', async () => {
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));
    await openElementaryMenu();

    const aiCard = document.querySelector('[data-module-id="ai"]');
    expect(aiCard).toBeTruthy();
    fireEvent.click(aiCard);

    expect(await screen.findByText('家教練習室')).toBeInTheDocument();
    expect(screen.getByText('先選模式，再用聊天微調。')).toBeInTheDocument();
    expect(screen.getByText('短句上手')).toBeInTheDocument();
    expect(screen.getByText('生活對話')).toBeInTheDocument();
    expect(screen.getByText('精準批改')).toBeInTheDocument();
    expect(screen.getByText('可朗讀、可複製')).toBeInTheDocument();
  });

  it('shows expanded grammar content with AI explanation for the current topic', async () => {
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));
    localStorage.removeItem('grammar_ai_elementary%3ABe%20%E5%8B%95%E8%A9%9E');

    await openElementaryMenu();

    const grammarCard = document.querySelector('[data-module-id="grammar"]');
    expect(grammarCard).toBeTruthy();
    fireEvent.click(grammarCard);

    expect(await screen.findByText('冠詞 a / an / the')).toBeInTheDocument();
    expect(screen.getByText('未來式 will / be going to')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Be 動詞').closest('button'));

    expect(await screen.findByText('例句庫')).toBeInTheDocument();
    expect(screen.getByText('加強練習')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('grammar-drill-0-option-2'));
    expect(await screen.findByText(/My friends 是複數，所以用 are。/)).toBeInTheDocument();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                simple: 'be 動詞像句子的連接橋。',
                examples: [
                  { en: 'I am ready.', zh: '我準備好了。' },
                  { en: 'They are in class.', zh: '他們在上課。' },
                ],
                practice: {
                  prompt: 'She ___ happy today.',
                  answer: 'is',
                  explanation: 'She 是單數第三人稱，所以用 is。',
                },
              }),
            }],
          },
        }],
      }),
    });

    try {
      fireEvent.click(screen.getByText('AI 講解'));

      expect(await screen.findByText('be 動詞像句子的連接橋。')).toBeInTheDocument();
      expect(screen.getByText('She ___ happy today.')).toBeInTheDocument();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.any(Object));
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('opens the lazy SRS module', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('單字卡');

    expect(await screen.findByText(/SRS 單字卡/)).toBeInTheDocument();
  });

  it('opens speaking practice and scores a recognized word without crashing', async () => {
    const OriginalSpeechRecognition = window.SpeechRecognition;
    const OriginalWebkitSpeechRecognition = window.webkitSpeechRecognition;
    class MockSpeechRecognition {
      constructor() {
        this.lang = '';
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.continuous = false;
      }
      start() {
        const result = { 0: { transcript: 'apple', confidence: 0.99 }, length: 1, isFinal: true };
        this.onresult?.({ resultIndex: 0, results: { 0: result, length: 1 } });
        this.onend?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    window.SpeechRecognition = MockSpeechRecognition;
    window.webkitSpeechRecognition = MockSpeechRecognition;

    try {
      await openElementaryMenu();

      const speakCard = document.querySelector('[data-module-id="speak"]');
      expect(speakCard).toBeTruthy();
      fireEvent.click(speakCard);

      expect(await screen.findByText('蘋果')).toBeInTheDocument();
      fireEvent.click(screen.getByText('🎤 直接開說'));

      expect(await screen.findByText('通過')).toBeInTheDocument();
      expect(screen.getByText(/準確度/)).toHaveTextContent('100%');
    } finally {
      window.SpeechRecognition = OriginalSpeechRecognition;
      window.webkitSpeechRecognition = OriginalWebkitSpeechRecognition;
    }
  });

  it('switches speaking practice into sentence-focused mode with guidance', async () => {
    const OriginalSpeechRecognition = window.SpeechRecognition;
    const OriginalWebkitSpeechRecognition = window.webkitSpeechRecognition;
    class MockSpeechRecognition {
      constructor() {
        this.lang = '';
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.continuous = false;
      }
      start() {}
      stop() {}
      abort() {}
    }
    window.SpeechRecognition = MockSpeechRecognition;
    window.webkitSpeechRecognition = MockSpeechRecognition;

    try {
      await openElementaryMenu();

      const speakCard = document.querySelector('[data-module-id="speak"]');
      expect(speakCard).toBeTruthy();
      fireEvent.click(speakCard);

      expect(await screen.findByText('練習模式')).toBeInTheDocument();
      expect(screen.getByText('先聽一次，再按麥克風跟讀。')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '句子練習' }));

      expect(await screen.findByText('I like to eat apples.')).toBeInTheDocument();
      expect(screen.getByText('看中文，唸出完整英文句子')).toBeInTheDocument();
      expect(screen.getAllByText('i').length).toBeGreaterThan(0);
      expect(screen.getAllByText('apples').length).toBeGreaterThan(0);
    } finally {
      window.SpeechRecognition = OriginalSpeechRecognition;
      window.webkitSpeechRecognition = OriginalWebkitSpeechRecognition;
    }
  });

  it('shows kid-friendly Chinese-like pronunciation help in speaking practice', async () => {
    const restoreSpeechRecognition = installMockSpeechRecognition();

    try {
      await openElementaryMenu();

      const speakCard = document.querySelector('[data-module-id="speak"]');
      expect(speakCard).toBeTruthy();
      fireEvent.click(speakCard);

      expect(await screen.findByText('發音小老師')).toBeInTheDocument();
      expect(screen.getByText('中文近似音')).toBeInTheDocument();
      expect(screen.getByText('欸-婆')).toBeInTheDocument();
      expect(screen.getByText('嘴巴先打開念「欸」，最後輕輕收成「婆」。')).toBeInTheDocument();
    } finally {
      restoreSpeechRecognition();
    }
  });

  it('uses Gemini to generate pronunciation coaching with Chinese-like sounds', async () => {
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));
    localStorage.removeItem('speak_pron_elementary%3Aapple');
    const restoreSpeechRecognition = installMockSpeechRecognition();

    try {
      await openElementaryMenu();

      const speakCard = document.querySelector('[data-module-id="speak"]');
      expect(speakCard).toBeTruthy();
      fireEvent.click(speakCard);

      expect(await screen.findByText('發音小老師')).toBeInTheDocument();

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  zhSound: '欸-婆',
                  syllables: 'ap · ple',
                  stress: '第一拍 ap',
                  mouth: '嘴巴先打開念「欸」，尾巴輕輕收住。',
                  mistake: '不要把 ple 念得太重。',
                  steps: ['先慢慢念「欸」', '接著補上「婆」', '最後連起來 apple'],
                }),
              }],
            },
          }],
        }),
      });

      try {
        fireEvent.click(screen.getByRole('button', { name: 'AI 補強發音' }));

        expect(await screen.findByText('第一拍 ap')).toBeInTheDocument();
        expect(screen.getByText('不要把 ple 念得太重。')).toBeInTheDocument();
        expect(screen.getByText('最後連起來 apple')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalled();
      } finally {
        fetchMock.mockRestore();
      }
    } finally {
      restoreSpeechRecognition();
    }
  });

  it('uses the whole sentence as the AI pronunciation target in sentence practice', async () => {
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));
    localStorage.removeItem('speak_pron_elementary%3Ai%20like%20to%20eat%20apples');
    const restoreSpeechRecognition = installMockSpeechRecognition();

    try {
      await openElementaryMenu();

      const speakCard = document.querySelector('[data-module-id="speak"]');
      expect(speakCard).toBeTruthy();
      fireEvent.click(speakCard);
      fireEvent.click(await screen.findByRole('button', { name: '句子練習' }));

      expect(await screen.findByText('I like to eat apples.')).toBeInTheDocument();
      expect(screen.queryByText(/重點單字：/)).not.toBeInTheDocument();
      expect(screen.getByText('整句近似音')).toBeInTheDocument();
      expect(screen.getByText('拆解對照')).toBeInTheDocument();
      expect(screen.getByText(/i → 愛/)).toBeInTheDocument();

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  zhSound: '愛 賴ク ㄊ 伊特',
                  syllables: 'I like / to eat apples',
                  stress: '整句重音：like / eat / apples',
                  mouth: '整句分成兩段，先說 I like，再接 to eat apples。',
                  mistake: '不要只練 apples，要把整句節奏接起來。',
                  steps: ['先聽整句一次', '分成兩段跟讀', '最後說完整句'],
                  words: [
                    { word: 'like', zhSound: '賴克' },
                    { word: 'apples', zhSound: '欸-婆-z' },
                  ],
                }),
              }],
            },
          }],
        }),
      });

      try {
        fireEvent.click(screen.getByRole('button', { name: 'AI 補強發音' }));

        expect(await screen.findByText('整句重音：like / eat / apples')).toBeInTheDocument();
        expect(screen.getByText('不要只練 apples，要把整句節奏接起來。')).toBeInTheDocument();
        expect(screen.queryByText(/賴ク|ㄊ/)).not.toBeInTheDocument();
        const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const promptText = requestBody.contents[0].parts[0].text;
        expect(promptText).toContain('完整英文句子');
        expect(promptText).toContain('I like to eat apples.');
        expect(promptText).toContain('不要使用注音符號');
        expect(promptText).not.toContain('重點單字：apples');
      } finally {
        fetchMock.mockRestore();
      }
    } finally {
      restoreSpeechRecognition();
    }
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

  it('generates grade-semester exam words into the review range with AI', async () => {
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));

    await openElementaryMenu();

    const examCard = document.querySelector('[data-module-id="exam"]');
    expect(examCard).toBeTruthy();
    fireEvent.click(examCard);

    expect(await screen.findByText('依學年、學期與數量填入單字範圍')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('exam-ai-term'), { target: { value: 'elementary-1b' } });
    fireEvent.change(screen.getByTestId('exam-ai-count'), { target: { value: '5' } });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                words: ['apple', 'book', 'cat', 'red', 'run'],
              }),
            }],
          },
        }],
      }),
    });

    try {
      fireEvent.click(screen.getByRole('button', { name: 'AI 產生單字' }));

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('apple book cat red run');
      });
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('apple')).toBeInTheDocument();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.any(Object));
      });
    } finally {
      fetchMock.mockRestore();
    }
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

      fireEvent.click(await screen.findByTestId('srs-card'));

      const backMedia = await screen.findByTestId('srs-back-media');
      expect(backMedia.querySelector(`img[src="${gifUrl}"]`)).toBeTruthy();
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

  it('uses the optimized SRS study layout after flipping a card', async () => {
    localStorage.removeItem('eg_gifkey');
    localStorage.removeItem('eg_gemkey');

    await openElementaryMenu();
    clickFirstModuleCard();

    expect(await screen.findByTestId('srs-study-guidance')).toHaveTextContent('點卡片看答案');

    fireEvent.click(await screen.findByTestId('srs-card'));

    expect(await screen.findByTestId('srs-back-primary')).toBeInTheDocument();
    expect(screen.getByTestId('srs-learning-details')).toBeInTheDocument();
    expect(screen.getByTestId('srs-rating-bar')).toBeInTheDocument();
    expect(screen.getByTestId('srs-support-actions')).toBeInTheDocument();
    expect(screen.getByTestId('srs-study-guidance')).toHaveTextContent('下一步');
    expect(screen.getByText('查字典補強')).toBeInTheDocument();
    expect(screen.getByTestId('srs-dictionary-action')).toHaveTextContent('小朋友字典');

    fireEvent.click(screen.getByText('🔎 查字典'));

    expect(await screen.findByRole('complementary', { name: 'Dictionary results' })).toBeInTheDocument();
    expect(screen.getByText('單字學習助手')).toBeInTheDocument();
    expect(screen.getByText('AI 字典留在頁面內')).toBeInTheDocument();
  });

  it('generates a level-aware AI story with reading guidance', async () => {
    localStorage.setItem('eg_gemkey', JSON.stringify('test-gemini-key'));
    localStorage.setItem(
      'eg_pets',
      JSON.stringify([{ petId: 'bunny', rarity: 'N', level: 3, exp: 0, bond: 8 }]),
    );

    const storyPayload = {
      title: 'Bunny and the Library Map',
      zh_title: '小兔兔和圖書館地圖',
      level_label: '小學 A1 友善故事',
      summary: '小兔兔在圖書館找到地圖，並學會問路。',
      pages: [
        {
          en: 'Bunny finds a map in the school library.',
          zh: '小兔兔在學校圖書館找到一張地圖。',
          word: 'library',
          meaning: '圖書館',
          keywords: ['library', 'map'],
        },
        {
          en: 'The map shows a quiet reading room.',
          zh: '地圖上有一間安靜的閱讀室。',
          word: 'quiet',
          meaning: '安靜的',
          keywords: ['quiet', 'room'],
        },
        {
          en: 'Bunny asks a teacher for help.',
          zh: '小兔兔向老師尋求幫忙。',
          word: 'teacher',
          meaning: '老師',
          keywords: ['teacher', 'help'],
        },
        {
          en: 'Bunny reads one page and smiles.',
          zh: '小兔兔讀了一頁，開心地笑了。',
          word: 'smiles',
          meaning: '微笑',
          keywords: ['reads', 'smiles'],
        },
      ],
      questions: [
        {
          q: 'Where does Bunny find the map?',
          zh_q: '小兔兔在哪裡找到地圖？',
          choices: ['In the library', 'At the zoo', 'On the bus', 'In the kitchen'],
          correct: 0,
          explain: 'Bunny finds the map in the school library.',
        },
        {
          q: 'Who helps Bunny?',
          choices: ['A teacher', 'A driver', 'A singer', 'A cook'],
          correct: 0,
          explain: 'Bunny asks a teacher for help.',
        },
        {
          q: 'How does Bunny feel at the end?',
          choices: ['Happy', 'Angry', 'Sleepy', 'Lost'],
          correct: 0,
          explain: 'Bunny smiles at the end.',
        },
      ],
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(storyPayload) }],
          },
        }],
      }),
    });

    try {
      await openElementaryMenu();

      fireEvent.click(document.querySelector('[data-group-id="read"]'));
      fireEvent.click(document.querySelector('[data-module-id="story"]'));

      expect(await screen.findByText('AI 會產生英中對照、重點單字與閱讀測驗')).toBeInTheDocument();
      fireEvent.click(screen.getByText('✨ 開始生成故事'));

      expect(await screen.findByText(/小兔兔和圖書館地圖/)).toBeInTheDocument();
      expect(screen.getByText('小學 A1 友善故事')).toBeInTheDocument();
      expect(screen.getByText(/第 1 頁 \/ 共 4 頁/)).toBeInTheDocument();
      expect(screen.getByText('本頁重點：library · 圖書館')).toBeInTheDocument();
      expect(screen.getByText('Bunny finds a map in the school library.')).toBeInTheDocument();

      await waitFor(() => {
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.contents[0].parts[0].text).toContain('Level rules for elementary');
        expect(body.contents[0].parts[0].text).toContain('focus word');
      });

      fireEvent.click(screen.getByText('下一頁 →'));
      expect(await screen.findByText('The map shows a quiet reading room.')).toBeInTheDocument();
      fireEvent.click(screen.getByText('下一頁 →'));
      expect(await screen.findByText('Bunny asks a teacher for help.')).toBeInTheDocument();
      fireEvent.click(screen.getByText('下一頁 →'));
      expect(await screen.findByText('Bunny reads one page and smiles.')).toBeInTheDocument();
      fireEvent.click(screen.getByText('📝 開始測驗'));

      expect(await screen.findByText('Where does Bunny find the map?')).toBeInTheDocument();
      expect(screen.getByText('小兔兔在哪裡找到地圖？')).toBeInTheDocument();
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

  it('opens novel vocabulary and quiz only when requested', async () => {
    await openElementaryMenu();

    clickFirstButtonWithText('閱讀聽力');
    clickFirstButtonWithText('英文小說');

    fireEvent.click(await screen.findByText('The Whispering Tree', {}, { timeout: 5000 }));

    expect(await screen.findByText('閱讀控制台')).toBeInTheDocument();
    expect(screen.queryByText('curious')).not.toBeInTheDocument();
    expect(screen.queryByText(/What did Lily find in the forest/)).not.toBeInTheDocument();

    const novelSettings = screen.getByTestId('novel-reading-settings');
    fireEvent.click(within(novelSettings).getByRole('button', { name: /重點單字/ }));
    expect(screen.getByTestId('novel-side-panel')).toBeInTheDocument();
    expect(screen.getByText('curious')).toBeInTheDocument();

    fireEvent.click(within(novelSettings).getByRole('button', { name: /章節測驗/ }));
    expect(await screen.findByText(/What did Lily find in the forest/)).toBeInTheDocument();
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
    const firstChapterCard = screen.getByTestId('novel-chapter-card-1');
    expect(within(firstChapterCard).getByText(/進行中 · Page 2/)).toBeInTheDocument();
    expect(within(firstChapterCard).getByText(/測驗 0\/3/)).toBeInTheDocument();

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
    expect(screen.getByTestId('novel-hero-media')).toHaveStyle({ overflow: 'visible' });
    expect(screen.getByTestId('novel-illustration-frame')).toHaveStyle({ height: '100%' });
    expect(screen.getByTestId('novel-reading-settings')).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
    expect(screen.getByTestId('novel-chapter-nav')).toHaveStyle({ gridTemplateColumns: '1fr 1fr' });
    expect(screen.getByTestId('novel-reader-panel')).toHaveStyle({ padding: '0 4px calc(18px + env(safe-area-inset-bottom))' });
    expect(screen.getByTestId('novel-page-actions')).toHaveStyle({
      position: 'sticky',
      bottom: '0',
      paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
    });

    fireEvent.click(within(screen.getByTestId('novel-reading-settings')).getByRole('button', { name: /章節測驗/ }));
    expect(screen.getByTestId('novel-side-panel')).toHaveStyle({ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' });

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

  it('returns to the same menu category after opening a module from that category', async () => {
    localStorage.setItem(
      'eg_pets',
      JSON.stringify([{ petId: 'bunny', rarity: 'N', level: 3, exp: 0, bond: 8 }]),
    );
    await openJuniorMenu();

    const petTab = document.querySelector('[data-group-id="pet"]');
    expect(petTab).toBeTruthy();
    fireEvent.click(petTab);

    const adventureCard = document.querySelector('[data-module-id="petAdventure"]');
    expect(adventureCard).toBeTruthy();
    fireEvent.click(adventureCard);

    expect(await screen.findByText(/寵物冒險/, {}, { timeout: 5000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← 返回' }));

    const returnedPetTab = document.querySelector('[data-group-id="pet"]');
    expect(returnedPetTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('扭蛋機')).toBeInTheDocument();
    expect(screen.getByText('寵物圖鑑')).toBeInTheDocument();
  }, 15000);

  it('shows pet care priorities and next-step hints without competition features', async () => {
    const today = new Date().toDateString();
    localStorage.setItem('eg_petAcc', JSON.stringify({ username: 'Kid', pinHash: 'demo', lastSync: today }));
    localStorage.setItem(
      'eg_pets',
      JSON.stringify([
        {
          petId: 'bunny',
          rarity: 'N',
          level: 2,
          exp: 30,
          bond: 20,
          hunger: 18,
          clean: 82,
          energy: 76,
          poops: [],
          lastUpdate: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem(
      'eg_eggs',
      JSON.stringify([{ id: 'egg-1', petId: 'chick', rarity: 'N', progress: 10, date: new Date().toISOString() }]),
    );
    localStorage.setItem('eg_inv', JSON.stringify({ apple: 2 }));
    localStorage.setItem('eg_petTasks', JSON.stringify({ date: today, counts: { feedToday: 1 } }));
    localStorage.setItem('eg_claimedTasks', JSON.stringify({ date: today, ids: [] }));

    await openElementaryMenu();
    clickMenuStat('寵物');

    const center = await screen.findByTestId('pet-care-center', {}, { timeout: 5000 });
    expect(within(center).getByText('今日照顧中心')).toBeInTheDocument();
    expect(within(center).getByText(/任務可領/)).toBeInTheDocument();
    expect(within(center).getByText(/蛋可孵化/)).toBeInTheDocument();
    expect(within(center).getByText(/優先照顧/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /寵物 \(1\)/ }));
    });
    const nextStep = await screen.findByTestId('pet-next-step-bunny');
    expect(nextStep).toHaveTextContent(/下一步/);
    expect(nextStep).toHaveTextContent(/餵/);
  }, 15000);

  it('shows a collection goal that points to the closest pet egg', async () => {
    const today = new Date().toDateString();
    localStorage.setItem('eg_petAcc', JSON.stringify({ username: 'Kid', pinHash: 'demo', lastSync: today }));
    localStorage.setItem(
      'eg_pets',
      JSON.stringify([
        {
          petId: 'bunny',
          rarity: 'N',
          level: 2,
          exp: 30,
          bond: 20,
          hunger: 82,
          clean: 82,
          energy: 76,
          poops: [],
          lastUpdate: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem(
      'eg_eggs',
      JSON.stringify([{ id: 'egg-1', petId: 'chick', rarity: 'N', progress: 7, date: new Date().toISOString() }]),
    );
    localStorage.setItem('eg_inv', JSON.stringify({ apple: 2 }));
    localStorage.setItem('eg_petTasks', JSON.stringify({ date: today, counts: {} }));
    localStorage.setItem('eg_claimedTasks', JSON.stringify({ date: today, ids: [] }));

    await openElementaryMenu();
    clickMenuStat('寵物');

    const goal = await screen.findByTestId('pet-collection-goal', {}, { timeout: 5000 });
    expect(goal).toHaveTextContent('收藏目標');
    expect(goal).toHaveTextContent('小雞');
    expect(goal).toHaveTextContent('7/10');
    expect(goal).toHaveTextContent(/還差 3 題英文/);
    expect(goal).toHaveTextContent('收藏進度');
    expect(goal).toHaveTextContent('1/29');
    expect(goal).toHaveTextContent(/還缺 28 種/);
    expect(goal).toHaveTextContent('下一枚徽章');
    expect(goal).toHaveTextContent('3 種寵物');
    expect(goal).toHaveTextContent(/還差 2 種/);
    const badges = within(goal).getByTestId('pet-collection-badges');
    expect(badges).toHaveTextContent('收藏徽章');
    expect(badges).toHaveTextContent('入門收藏');
    expect(badges).toHaveTextContent('1/3');
    expect(badges).toHaveTextContent('進行中');
    expect(badges).toHaveTextContent('10 種');
  }, 15000);

  it('shows a clear result after completing a pet care action', async () => {
    const today = new Date().toDateString();
    localStorage.setItem('eg_petAcc', JSON.stringify({ username: 'Kid', pinHash: 'demo', lastSync: today }));
    localStorage.setItem(
      'eg_pets',
      JSON.stringify([
        {
          petId: 'bunny',
          rarity: 'N',
          level: 2,
          exp: 30,
          bond: 20,
          hunger: 18,
          clean: 82,
          energy: 76,
          poops: [],
          lastUpdate: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem('eg_eggs', JSON.stringify([]));
    localStorage.setItem('eg_inv', JSON.stringify({ apple: 2 }));
    localStorage.setItem('eg_petTasks', JSON.stringify({ date: today, counts: {} }));
    localStorage.setItem('eg_claimedTasks', JSON.stringify({ date: today, ids: [] }));

    await openElementaryMenu();
    clickMenuStat('寵物');

    await screen.findByTestId('pet-care-center', {}, { timeout: 5000 });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /寵物 \(1\)/ }));
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      fireEvent.click(await screen.findByTestId('pet-card-bunny'));
      fireEvent.click(await screen.findByTestId('pet-primary-care-action'));
      fireEvent.click(await screen.findByTestId('pet-action-complete'));

      const result = await screen.findByTestId('pet-care-result');
      expect(result).toHaveTextContent('照顧完成');
      expect(result).toHaveTextContent(/餵|吃/);
      expect(result).toHaveTextContent(/飽|飢餓|狀態/);
      expect(result).toHaveTextContent('今日培養 1/3');
      expect(result).toHaveTextContent(/再完成 2 種照顧/);
    } finally {
      randomSpy.mockRestore();
    }
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
