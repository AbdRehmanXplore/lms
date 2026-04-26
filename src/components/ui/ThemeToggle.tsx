'use client';

import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [tick, setTick] = useState(0);
  const dark = typeof document === 'undefined' ? true : document.documentElement.classList.contains('dark');

  const toggle = () => {
    const next = !dark;
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    setTick((v) => v + 1);
  };

  return (
    <button
      key={tick}
      onClick={toggle}
      className="p-2 rounded-lg border border-[var(--border)] 
        bg-[var(--bg-surface-2)] text-[var(--text-secondary)] 
        hover:text-[var(--text-primary)] hover:bg-[var(--border)] 
        transition-all duration-200"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
