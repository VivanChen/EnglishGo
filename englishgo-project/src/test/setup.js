import '@testing-library/jest-dom/vitest';

beforeEach(() => {
  localStorage.clear();
});

Object.defineProperty(window.navigator, 'onLine', {
  configurable: true,
  value: true,
});

window.HTMLElement.prototype.scrollTo = window.HTMLElement.prototype.scrollTo || function scrollTo() {};
window.HTMLElement.prototype.scrollIntoView =
  window.HTMLElement.prototype.scrollIntoView || function scrollIntoView() {};
