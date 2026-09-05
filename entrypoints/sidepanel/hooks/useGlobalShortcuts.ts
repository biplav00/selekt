import { useEffect } from 'react';

export function useGlobalShortcuts(isInspecting: boolean, onEscape: () => void): void {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isInspecting) {
        onEscape();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isInspecting, onEscape]);
}
