// Runs before the module graph, including when the entry module cannot load.
(() => {
  let recovering = false;
  function recover() {
    if (recovering) return;
    recovering = true;
    const key = 'englishgo-asset-recovery';
    let retry = false;
    try {
      const previous = Number(sessionStorage.getItem(key) || 0);
      retry = Date.now() - previous > 60000 && navigator.onLine !== false;
      if (retry) sessionStorage.setItem(key, String(Date.now()));
    } catch { /* Show a manual retry when storage is unavailable. */ }
    if (retry) {
      location.reload();
      return;
    }
    const panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;gap:20px;padding:24px;background:#fafaf6;color:#356a50;text-align:center;font:18px sans-serif';
    const message = document.createElement('p');
    message.textContent = '頁面檔案未能載入，請確認網路連線後重試。';
    const button = document.createElement('button');
    button.textContent = '重新載入';
    button.style.cssText = 'padding:14px 24px;border:0;border-radius:12px;background:#356a50;color:white;font:inherit;cursor:pointer';
    button.onclick = () => location.reload();
    panel.append(message, button);
    document.body.append(panel);
  }
  window.addEventListener('vite:preloadError', recover);
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target?.tagName === 'SCRIPT' && target.type === 'module') recover();
    if (target?.tagName === 'LINK' && target.rel === 'stylesheet' && target.href.includes('/assets/')) recover();
  }, true);
})();
