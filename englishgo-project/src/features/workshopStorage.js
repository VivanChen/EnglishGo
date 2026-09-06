import { useRef, useState } from 'react';

// Write before reward callbacks. All event handlers read the current ref, even on a rapid repeat.
export function useWorkshopStorage(key, fallback = {}, validate = value => value && typeof value === 'object' ? value : null) {
  const [book, setBook] = useState(() => { try { return validate(JSON.parse(localStorage.getItem(key))) || fallback; } catch { return fallback; } });
  const live = useRef(book), [saveError, setSaveError] = useState(false);
  const save = next => {
    live.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); setSaveError(false); } catch { setSaveError(true); }
    setBook(next);
  };
  return { book, live, save, saveError };
}
