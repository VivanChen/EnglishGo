import { makeNovelAudioItem } from './novelAudio.js';

export function pictureBookAudioInput(book, index) {
  return { novelId: `picture-book-${book.id}`, chapterNo: index + 1, lang: 'en-US', text: book.pages[index].en };
}

export function pictureBookAudioItem(book, index) {
  return makeNovelAudioItem(pictureBookAudioInput(book, index));
}
