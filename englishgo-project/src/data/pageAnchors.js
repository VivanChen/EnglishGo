const PAGE_ANCHORS = new Set(['#choose-level', '#learning-content']);

export function withoutPageAnchor(href) {
  const url = new URL(href);
  if (PAGE_ANCHORS.has(url.hash)) url.hash = '';
  return url.href;
}

export function followPageAnchor(event) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(event.currentTarget.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
  // Scrolling within a screen must not create an extra browser Back entry.
  const cleanUrl = withoutPageAnchor(window.location.href);
  if (cleanUrl !== window.location.href) window.history.replaceState(window.history.state, '', cleanUrl);
}
