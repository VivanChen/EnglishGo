import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(()=>vi.restoreAllMocks());

async function openCards() {
  vi.spyOn(Math,'random').mockReturnValue(.999999);
  render(<App/>);
  fireEvent.click(screen.getByText('Elementary').closest('button'));
  fireEvent.click(await screen.findByRole('button',{name:/約 5 分鐘 單字卡/}));
  fireEvent.click(await screen.findByRole('button',{name:/全部單字，\d+ 個單字/},{timeout:10000}));
  return screen.findByTestId('srs-card');
}

it('discards a retired media key without requesting external media or losing the card', async()=>{
  localStorage.setItem('eg_gifkey',JSON.stringify('retired-media-key'));
  const fetchMock=vi.spyOn(globalThis,'fetch');
  await openCards();
  expect(localStorage.getItem('eg_gifkey')).toBeNull();
  expect(fetchMock.mock.calls.filter(([url])=>/giphy|tenor/i.test(String(url)))).toHaveLength(0);
  expect(screen.getByTestId('srs-front-media').querySelector('img')).toHaveAttribute('src','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/apple-01-v1.webp');
  fireEvent.click(screen.getByRole('button',{name:'開啟操作說明'}));
  expect(screen.queryByText(/Giphy|動圖|GIF/)).not.toBeInTheDocument();
});

it('uses hand-drawn art and preserves a fallback when that image fails', async()=>{
  await openCards();
  const media=screen.getByTestId('srs-front-media');
  expect(media).toHaveTextContent('手繪插畫');
  expect(media.querySelector('img')).toHaveAttribute('src','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/apple-01-v1.webp');
  fireEvent.error(media.querySelector('img'));
  expect(media).not.toHaveTextContent('手繪插畫');
  expect(screen.getByRole('button',{name:'播放單字 apple'})).toBeInTheDocument();
});

it('keeps the back illustration gallery after a front illustration fails', async()=>{
  const card=await openCards();
  const media=screen.getByTestId('srs-front-media');
  fireEvent.error(media.querySelector('img'));
  expect(screen.getByRole('button',{name:'播放單字 apple'})).toBeInTheDocument();
  fireEvent.click(card);
  expect(await screen.findByTestId('srs-back-illustrations')).toHaveTextContent('This is a red apple.');
});

it('shows a Gemini permission error with a settings action and keeps local dictionary content',async()=>{
  localStorage.setItem('eg_gemkey',JSON.stringify('feedback-gemini-key'));
  vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false,status:403,json:async()=>({error:{code:403,message:'do-not-display-this-secret'}})});
  const card=await openCards();fireEvent.click(card);
  fireEvent.click(screen.getByTestId('srs-dictionary-action'));
  expect(await screen.findByText(/Gemini API Key 無效或權限不足/)).toBeInTheDocument();
  expect(screen.getByTestId('srs-local-dictionary')).toBeInTheDocument();
  expect(screen.queryByText(/do-not-display-this-secret/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'API Key 設定',exact:true}));
  expect(await screen.findByRole('heading',{name:'設定',exact:true})).toBeInTheDocument();
  expect(screen.getByText('已填入・未驗證')).toBeInTheDocument();
});
