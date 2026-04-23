import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service worker registered:', reg.scope);
        // Check for updates every hour
        setInterval(() => reg.update(), 3600000);
      })
      .catch((err) => {
        console.log('[PWA] SW registration failed:', err);
      });
  });
}
