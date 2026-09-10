import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App.jsx';
it('opens and restores unified settings without selecting a grade', async()=>{
  const view=render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'API Key 設定 · Gemini／Giphy'}));
  expect(await screen.findByRole('heading',{name:'API Key 設定'})).toBeInTheDocument();
  expect(screen.getByLabelText('Gemini API Key')).toHaveAttribute('type','password');
  expect(screen.getByLabelText('Giphy API Key')).toHaveAttribute('type','password');
  expect(window.history.state.englishGoNavigation.lv).toBeNull();
  view.unmount();render(<App/>);
  expect(await screen.findByRole('heading',{name:'API Key 設定'})).toBeInTheDocument();
});
