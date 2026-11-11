import { useState, useEffect } from 'react';

/**
 * A simple hook that syncs a single localStorage key with React state.
 * Avoids the repetitive useState(() => localStorage.getItem(...)) + useEffect pattern.
 *
 * @param {string} key - The localStorage key to read/write.
 * @param {*} defaultValue - The default value when nothing is stored yet.
 * @returns {[*, Function]} - [value, setValue] tuple, same as useState.
 */
export function useLocalStorageSetting(key, defaultValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    if (stored === null || stored === undefined) return defaultValue;
    // Try to parse numbers back (stored as strings), matching `Number(stored) || defaultValue`
    if (typeof defaultValue === 'number') {
      if (stored === '') return defaultValue;
      const num = Number(stored);
      return isNaN(num) || num === 0 ? defaultValue : num;
    }
    return stored || defaultValue;
  });

  useEffect(() => {
    if (value === null || value === undefined) return;
    localStorage.setItem(key, String(value));
  }, [key, value]);

  return [value, setValue];
}

