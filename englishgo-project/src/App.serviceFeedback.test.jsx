import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(()=>vi.restoreAllMocks());

async function openCards() {
  vi.spyOn(Math,'random').mockReturnValue(.999999);
  render(<App/>);
  fireEvent.click(screen.getByText('Elementary').closest('button'));
  fireEvent.click(await screen.findByRole('button',{name:/約 5 分鐘 單字卡/}));
  fireEvent.click(await screen.findByRole('button',{name:/全部單字，\d+ 個單字/}));
  return screen.findByTestId('srs-card');
}

it('explains Giphy quota failures, preserves the card, and lets a user retry successfully', async()=>{
  localStorage.setItem('eg_gifkey',JSON.stringify('feedback-test-key'));
  let recover=false;
  const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>({ok:recover,status:recover?200:429,json:async()=>recover?{data:{images:{fixed_height_small:{url:'https://media.giphy.com/feedback.gif'}}}}:{}}));
  await openCards();
  expect(await screen.findByText(/Giphy 目前達到使用限制/)).toBeInTheDocument();
  expect(screen.getByTestId('srs-card')).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url])=>url.includes('api.giphy.com'))).toHaveLength(1);
  recover=true;fireEvent.click(screen.getByRole('button',{name:'重試動圖'}));
  await waitFor(()=>expect(document.querySelector('img[src="https://media.giphy.com/feedback.gif"]')).toBeTruthy());
  expect(screen.queryByText(/Giphy 目前達到使用限制/)).not.toBeInTheDocument();
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
  expect(await screen.findByRole('heading',{name:'API Key 設定'})).toBeInTheDocument();
  expect(screen.getByText('已填入・未驗證')).toBeInTheDocument();
});
