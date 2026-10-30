import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { resetProgressOnce } from './data/progressReset.js';
import './ui-polish.css';
import './learning-experience.css';
import './arcade.css';
import './practice-world.css';
import './learning-workshops.css';
import './study-planning.css';
import './learning-desk.css';

try { resetProgressOnce(localStorage, sessionStorage, window.history); }
catch (error) { console.warn('[Progress] Unable to reset local progress', error); }

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
