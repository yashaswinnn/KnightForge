import { useState, useCallback, useEffect } from 'react';

// Simple module-level broadcast so any component can call toast()
const listeners = new Set();
let nextId = 0;

export function toast(opts) {
  const id = ++nextId;
  listeners.forEach((fn) => fn({ id, ...opts }));
  return id;
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((t) => {
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => listeners.delete(addToast);
  }, [addToast]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { toast, toasts, dismiss };
}
