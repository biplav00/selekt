import { useCallback, useEffect, useState } from 'react';
import type { ManualAttempt } from '../types';

export interface ManualResult {
  count: number;
  error: string | null;
}

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function useManual(activeTab: 'inspect' | 'manual', url: string) {
  const [manualLocator, setManualLocator] = useState('');
  const [manualResult, setManualResult] = useState<ManualResult | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [history, setHistory] = useState<ManualAttempt[]>([]);

  const sendToActiveTab = useCallback(async (type: string, payload?: Record<string, unknown>) => {
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((tab) => tab.url && tab.url.startsWith('http'));
      let target = tabs.find((tab) => tab.active && tab.url && tab.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) {
        const [active] = await browser.tabs.query({ active: true, currentWindow: true });
        target = active;
      }
      if (!target?.id) return;
      await browser.tabs.sendMessage(target.id, { type, ...payload }).catch(() => {
        void 0;
      });
    } catch {
      void 0;
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((tab) => tab.url && tab.url.startsWith('http'));
      let target = tabs.find((tab) => tab.active && tab.url && tab.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) target = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!target?.id) return;
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
    const id = setTimeout(() => {
      void handleManualHighlight();
    }, 300);
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
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((tab) => tab.url && tab.url.startsWith('http'));
      let target = tabs.find((tab) => tab.active && tab.url && tab.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) target = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!target?.id) return;
      const response = (await browser.tabs
        .sendMessage(target.id, { type: 'manual:highlight', locator: normalized })
        .catch(() => null)) as ManualResult | null;
      if (response) {
        const result = { count: response.count ?? 0, error: response.error ?? null };
        setManualResult(result);
        if (record) {
          setHistory((prev) =>
            prev[0]?.query === query
              ? prev
              : [{ time: stamp(), query, ...result }, ...prev].slice(0, 20)
          );
        }
      } else {
        setTimeout(() => {
          setManualResult(
            (prev) => prev ?? { count: 0, error: 'No response — check page permissions' }
          );
        }, 800);
      }
    } catch {
      void 0;
    }
  };

  const handleManualClear = async () => {
    setManualResult(null);
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((tab) => tab.url && tab.url.startsWith('http'));
      let target = tabs.find((tab) => tab.active && tab.url && tab.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) target = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!target?.id) return;
      await browser.tabs.sendMessage(target.id, { type: 'manual:clear' }).catch(() => {
        void 0;
      });
    } catch {
      void 0;
    }
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
