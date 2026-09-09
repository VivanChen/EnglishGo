import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { beforeEach, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'public/app-recovery.js'), 'utf8');
beforeEach(() => { document.body.innerHTML = ''; sessionStorage.clear(); });
function setup(online = true) {
  const handlers = {};
  const reload = vi.fn();
  runInNewContext(source, {
    window: { addEventListener: (type, handler) => { handlers[type] = handler; } },
    document, sessionStorage, navigator: { onLine: online }, location: { reload }, Date,
  });
  return { handlers, reload };
}
it('reloads only once when several chunks fail together', () => {
  const { handlers, reload } = setup();
  handlers['vite:preloadError']();
  handlers['vite:preloadError']();
  expect(reload).toHaveBeenCalledTimes(1);
});
it('shows a retry button instead of a reload loop on the next page load', () => {
  setup().handlers['vite:preloadError']();
  const { handlers, reload } = setup();
  handlers['vite:preloadError']();
  expect(reload).not.toHaveBeenCalled();
  expect(document.querySelector('[role=alert]')).not.toBeNull();
  document.querySelector('button').click();
  expect(reload).toHaveBeenCalledTimes(1);
});
it('handles an entry module failure while offline without reloading', () => {
  const { handlers, reload } = setup(false);
  handlers.error({ target: { tagName: 'SCRIPT', type: 'module' } });
  expect(reload).not.toHaveBeenCalled();
  expect(document.querySelector('button').textContent).toBe('重新載入');
});
it('ignores unrelated image errors', () => {
  const { handlers, reload } = setup();
  handlers.error({ target: { tagName: 'IMG' } });
  expect(reload).not.toHaveBeenCalled();
  expect(document.body.children).toHaveLength(0);
});
