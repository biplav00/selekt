import { useCallback, useEffect, useState } from 'react';
import type { ManualAttempt, ManualResult } from '../types';
import { HISTORY_LIMIT } from '../types';
import { timeStamp } from '../../../utils/time';
import { findProbeTab } from '../../../utils/tabs';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useManual(activeTab: 'inspect' | 'manual', url: string) {
  const [manualLocator, setManualLocator] = useState('');
  const [manualResult, setManualResult] = useState<ManualResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [history, setHistory] = useState<ManualAttempt[]>([]);

  const sendToActiveTab = useCallback(async (type: string, payload?: Record<string, unknown>) => {
    const target = await findProbeTab();
    if (!target?.id) return;
    try {
      await browser.tabs.sendMessage(target.id, { type, ...payload }).catch(() => {
        void 0;
      });
    } catch {
      void 0;
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    const target = await findProbeTab();
    if (!target?.id) return;
    try {
      const response = (await browser.tabs
        .sendMessage(target.id, { type: 'manual:suggestions' })
        .catch(() => null)) as { suggestions?: string[] } | null;
      if (response?.suggestions) setSuggestions(response.suggestions);
    } catch {
      void 0;
    }
  }, []);

  // Live search as you type
  useEffect(() => {
    if (activeTab !== 'manual') return;
    const trimmed = manualLocator.trim();
    if (!trimmed) {
      sendToActiveTab('manual:clear').catch(() => {
        void 0;
      });
      setManualResult(null);
      return;
    }
    // Role/text patterns walk the entire DOM per run — debounce those
    // harder so fast typing doesn't jank heavy pages.
    const delay = /getByRole|getByText/i.test(trimmed) ? 800 : 300;
    const id = setTimeout(() => {
      void handleManualHighlight();
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualLocator, activeTab]);

  useEffect(() => {
    if (activeTab === 'manual') {
      void fetchSuggestions();
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [activeTab, url, fetchSuggestions]);

  const handleManualHighlight = async (record = false) => {
    const query = manualLocator.trim();
    if (!query) return;
    // Accept the shortened form too: bare getBy*/locator( isn't valid CSS and
    // would otherwise always error, so restore the page. prefix for evaluation.
    const normalized = /^(getBy[A-Z]\w*|locator)\s*\(/.test(query) ? `page.${query}` : query;
    setManualResult(null);
    const sendHighlight = async () => {
      const target = await findProbeTab();
      if (!target?.id) return null;
      return (await browser.tabs
        .sendMessage(target.id, { type: 'manual:highlight', locator: normalized })
        .catch(() => null)) as ManualResult | null;
    };
    try {
      let response = await sendHighlight();
      // The content script may still be injecting right after navigation —
      // one retry before reporting the page unreachable.
      if (!response) {
        await sleep(1000);
        response = await sendHighlight();
      }
      if (response) {
        const result = { count: response.count ?? 0, error: response.error ?? null };
        setManualResult(result);
        if (record) {
          setHistory((prev) =>
            prev[0]?.query === query
              ? prev
              : [{ time: timeStamp(), query, ...result }, ...prev].slice(0, HISTORY_LIMIT)
          );
        }
      } else {
        setManualResult({ count: 0, error: 'No response — check page permissions' });
      }
    } catch {
      void 0;
    }
  };

  const handleManualClear = async () => {
    setManualLocator('');
    setManualResult(null);
    setShowSuggestions(false);
    try {
      await sendToActiveTab('manual:clear', {});
    } catch {
      void 0;
    }
  };

  const handleSuggestionClick = (value: string) => {
    const hasEmpty = value.includes("''");
    setManualLocator(value);
    setShowSuggestions(false);
    setSelectedSuggestion(0);
    setTimeout(() => {
      if (hasEmpty) {
        const input = document.querySelector(
          'textarea[aria-label="Manual locator"]'
        ) as HTMLTextAreaElement | null;
        if (input) {
          input.focus();
          const idx = value.indexOf("''") + 1;
          try {
            input.setSelectionRange(idx, idx);
          } catch {
            void 0;
          }
        }
      }
    }, 0);
  };

  return {
    manualLocator,
    setManualLocator,
    manualResult,
    setManualResult,
    history,
    clearHistory: () => setHistory([]),
    suggestions,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestion,
    setSelectedSuggestion,
    fetchSuggestions,
    handleManualHighlight,
    handleManualClear,
    handleSuggestionClick,
    sendToActiveTab,
  };
}
