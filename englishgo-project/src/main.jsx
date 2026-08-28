import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './ui-polish.css';

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
        setInterval(() => reg.update(), 3600000);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[PWA] Service worker registration failed:', err);
      });
  });
}
