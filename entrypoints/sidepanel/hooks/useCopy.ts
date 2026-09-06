import { useState, useCallback } from 'react';

export function useCopy(displayLocator: (value: string) => string) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(
    async (value: string) => {
      const toCopy = displayLocator(value);
      let ok = false;
      try {
        await navigator.clipboard.writeText(toCopy);
        ok = true;
      } catch {
        try {
          const ta = document.createElement('textarea');
          ta.value = toCopy;
          document.body.appendChild(ta);
          ta.select();
          ok = (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand(
            'copy'
          );
          ta.remove();
        } catch {
          void 0;
        }
      }
      if (ok) {
        setCopied(value);
        setTimeout(() => setCopied((current) => (current === value ? null : current)), 1400);
      }
    },
    [displayLocator]
  );

  return { copied, copy, setCopied };
}
