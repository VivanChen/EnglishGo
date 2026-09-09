import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import PictureBookStage from './PictureBookStage.jsx';
import { PICTURE_BOOKS } from '../data/pictureBooks.js';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
const book = PICTURE_BOOKS[0];
it('replays a paper character response on every click and sends its vocabulary to narration', () => {
  const onPick = vi.fn();
  render(<PictureBookStage book={book} page={book.pages[0]} index={0} motion view={0} onPick={onPick}/>);
  const fox = screen.getByRole('button', { name: '場景 fox（狐狸）' });
  fireEvent.click(fox);
  const first = fox.querySelector('.react-hop');
  expect(first).not.toBeNull();
  fireEvent.click(fox);
  expect(fox.querySelector('.react-hop')).not.toBe(first);
  expect(onPick).toHaveBeenCalledTimes(2);
  expect(onPick).toHaveBeenLastCalledWith(book.pages[0].objects[0]);
});
it('flips the sheet in either direction while retaining the book stage', () => {
  const props = { book, motion: true, view: 0, onPick: vi.fn() };
  const { rerender } = render(<PictureBookStage {...props} page={book.pages[0]} index={0}/>);
  rerender(<PictureBookStage {...props} page={book.pages[1]} index={1}/>);
  expect(document.querySelector('.pb-paper-sheet.forward')).not.toBeNull();
  rerender(<PictureBookStage {...props} page={book.pages[0]} index={0}/>);
  expect(document.querySelector('.pb-paper-sheet.back')).not.toBeNull();
});
