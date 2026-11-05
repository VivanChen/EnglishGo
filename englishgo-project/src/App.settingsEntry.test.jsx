import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import App from './App.jsx';
it('opens and restores unified settings without selecting a grade', async()=>{
  const view=render(<App/>);
  const section=document.querySelector('.eg-grownup');
  expect(section).not.toHaveAttribute('open');
  expect(document.querySelector('.eg-key-entry')).toBeNull();
  fireEvent.click(section.querySelector('summary'));
  section.open=true;
  fireEvent.click(screen.getByRole('button',{name:'設定（朗讀、Gemini）'}));
  expect(await screen.findByRole('heading',{name:'設定'})).toBeInTheDocument();
  expect(screen.getByLabelText('Gemini API Key')).toHaveAttribute('type','password');
  expect(screen.queryByLabelText('Giphy API Key')).not.toBeInTheDocument();
  expect(window.history.state.englishGoNavigation.lv).toBeNull();
  view.unmount();render(<App/>);
  expect(await screen.findByRole('heading',{name:'設定'})).toBeInTheDocument();
});
