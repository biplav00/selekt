import { useEffect, useState } from 'react';

interface Locator {
  kind: string;
  value: string;
  score: number;
}
interface Meta {
  tag: string;
  text: string;
  id: string;
  className: string;
  attributes?: string;
}
type PickerState = { active: boolean; locked?: boolean };

export default function App() {
  const [isInspecting, setIsInspecting] = useState(false);
  const [locators, setLocators] = useState<Locator[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [hoverPreview, setHoverPreview] = useState<Meta | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [manualLocator, setManualLocator] = useState('');
  const [manualResult, setManualResult] = useState<{ count: number; error: string | null } | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'inspect' | 'manual'>('inspect');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<{ theme: 'light' | 'dark'; omitPage: boolean }>({
    theme: 'light',
    omitPage: false,
  });

  // Load settings from storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await browser.storage?.local.get(['locatorSettings']);
        const s = (stored as any)?.locatorSettings as typeof settings | undefined;
        if (s) {
          setSettings(s);
          document.documentElement.setAttribute('data-theme', s.theme);
          if (s.theme === 'dark') document.documentElement.classList.add('dark');
        }
      } catch { void 0; }
    })();
  }, []);

  const updateSettings = async (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    document.documentElement.setAttribute('data-theme', next.theme);
    if (next.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try {
      await browser.storage?.local.set({ locatorSettings: next });
    } catch { void 0; }
    // Also persist to localStorage as fallback
    try {
      localStorage.setItem('locatorSettings', JSON.stringify(next));
    } catch { void 0; }
  };

  const displayLocator = (val: string) => {
    if (settings.omitPage) return val.replace(/^page\./, '');
    return val;
  };

  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === 'locators' && msg.payload?.locators) {
        setLocators(msg.payload.locators);
        setMeta(msg.payload.meta || null);
        setUrl(msg.payload.url || '');
        setIsInspecting(false);
        setTimeout(() => document.getElementById('locator-list')?.focus(), 60);
      }
      if (msg?.type === 'picker:hover' && msg.payload) setHoverPreview(msg.payload);
      if (msg?.type === 'picker:state') setIsInspecting(!!(msg.payload as PickerState).active);
      if (msg?.type === 'manual:result' && msg.payload) {
        if (msg.payload.cleared) {
          setManualResult(null);
        } else {
          setManualResult({ count: msg.payload.count, error: msg.payload.error });
        }
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInspecting) {
        sendToActiveTab('picker:off');
        setIsInspecting(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isInspecting]);

  // Live search as you type — Manual tab
  useEffect(() => {
    if (activeTab !== 'manual') return;
    const trimmed = manualLocator.trim();
    if (!trimmed) {
      // Clear highlights when input emptied
      sendToActiveTab('manual:clear').catch(() => {});
      setManualResult(null);
      return;
    }
    // Debounce 300ms
    const id = setTimeout(() => {
      handleManualHighlight();
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualLocator, activeTab]);

  // Fetch dynamic suggestions when Manual tab opens or page changes
  const fetchSuggestions = async () => {
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((t: any) => t.url && t.url.startsWith('http'));
      let target = tabs.find((t: any) => t.active && t.url && t.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) target = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!target?.id) return;
      const response: any = await browser.tabs
        .sendMessage(target.id, { type: 'manual:suggestions' })
        .catch(() => null);
      if (response?.suggestions) {
        setSuggestions(response.suggestions);
      }
    } catch { void 0; }
  };

  useEffect(() => {
    if (activeTab === 'manual') {
      fetchSuggestions();
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    // also refetch when url changes (new page)
  }, [activeTab, url]);

  const filteredSuggestions = (() => {
    const q = manualLocator.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  })();

  const handleSuggestionClick = (s: string) => {
    // If suggestion has empty placeholder like "page.getByTestId('')" - put cursor inside
    const hasEmpty = s.includes("''");
    setManualLocator(s);
    setShowSuggestions(false);
    setSelectedSuggestion(0);
    // Trigger highlight on next tick
    setTimeout(() => {
      // handled by live search useEffect, but also trigger immediately for empty placeholder
      if (hasEmpty) {
        // Focus input and select placeholder
        const input = document.querySelector(
          'input[aria-label="Manual locator"]'
        ) as HTMLInputElement | null;
        if (input) {
          input.focus();
          const idx = s.indexOf("''") + 1;
          try {
            input.setSelectionRange(idx, idx);
          } catch { void 0; }
        }
      }
    }, 0);
  };

  const sendToActiveTab = async (type: string, payload?: any) => {
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((t: any) => t.url && t.url.startsWith('http'));
      let target = tabs.find((t: any) => t.active && t.url && t.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) {
        const [active] = await browser.tabs.query({ active: true, currentWindow: true });
        target = active;
      }
      if (!target?.id) return;
      await browser.tabs.sendMessage(target.id, { type, ...payload }).catch(() => {});
    } catch { void 0; }
  };

  const handleManualHighlight = async () => {
    if (!manualLocator.trim()) return;
    setManualResult(null);
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((t: any) => t.url && t.url.startsWith('http'));
      let target = tabs.find((t: any) => t.active && t.url && t.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) target = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!target?.id) return;
      const response: any = await browser.tabs
        .sendMessage(target.id, { type: 'manual:highlight', locator: manualLocator.trim() })
        .catch(() => null);
      if (response) {
        setManualResult({ count: response.count ?? 0, error: response.error ?? null });
      } else {
        setTimeout(() => {
          setManualResult(
            (prev) => prev ?? { count: 0, error: 'No response — check page permissions' }
          );
        }, 800);
      }
    } catch { void 0; }
  };

  const handleManualClear = async () => {
    setManualResult(null);
    try {
      const tabs = await browser.tabs.query({});
      const httpTabs = tabs.filter((t: any) => t.url && t.url.startsWith('http'));
      let target = tabs.find((t: any) => t.active && t.url && t.url.startsWith('http'));
      if (!target) target = httpTabs[0];
      if (!target) target = (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (!target?.id) return;
      await browser.tabs.sendMessage(target.id, { type: 'manual:clear' }).catch(() => {});
    } catch { void 0; }
    try {
      await sendToActiveTab('manual:clear', {});
    } catch { void 0; }
  };

  const toggleInspect = async () => {
    if (isInspecting) {
      setIsInspecting(false);
      await sendToActiveTab('picker:off');
    } else {
      setLocators([]);
      setMeta(null);
      setHoverPreview(null);
      setIsInspecting(true);
      await sendToActiveTab('picker:on');
    }
  };

  const handleReset = async () => {
    setLocators([]);
    setMeta(null);
    setHoverPreview(null);
    setManualLocator('');
    setManualResult(null);
    setCopied(null);
    setIsInspecting(false);
    await sendToActiveTab('picker:off');
    await sendToActiveTab('picker:clear');
    await sendToActiveTab('manual:clear');
  };

  const copy = async (value: string) => {
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
        ok = (document as any).execCommand('copy');
        ta.remove();
      } catch { void 0; }
    }
    if (ok) {
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1400);
    }
  };

  const renderLocator = (val: string) => {
    const displayVal = displayLocator(val);
    const m = displayVal.match(/^(page\.)?(getBy\w+|locator)(.*)$/);
    if (!m) return <>{displayVal}</>;
    const hasPage = !!m[1];
    return (
      <>
        {hasPage && <span style={{ color: '#71717a' }}>{m[1]}</span>}
        <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{m[2]}</span>
        <span style={{ color: 'var(--muted)' }}>{m[3]}</span>
      </>
    );
  };

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      {/* Header — Linear Clean: soft, rounded, subtle */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--ink)',
              color: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ⌖
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              Locator Inspector
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: 'var(--muted)',
                lineHeight: 1,
              }}
            >
              Playwright • Side Panel
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              padding: '4px 8px',
              borderRadius: 9999,
              color: 'var(--muted)',
            }}
          >
            v0.1.0
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Settings"
            title="Settings"
            aria-expanded={showSettings}
            style={{
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              background: showSettings ? 'var(--ink)' : 'var(--surface)',
              color: showSettings ? 'var(--surface)' : 'var(--muted)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          style={{
            padding: '12px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700 }}>
              Settings
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              aria-label="Close settings"
              style={{
                width: 24,
                height: 24,
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--muted)',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>
                  Theme
                </div>
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}
                >
                  {settings.theme === 'dark' ? 'Dark' : 'Light'} • Linear Clean
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: 'light' })}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: `1px solid ${settings.theme === 'light' ? 'var(--ink)' : 'var(--line)'}`,
                    background: settings.theme === 'light' ? 'var(--ink)' : 'var(--surface)',
                    color: settings.theme === 'light' ? 'var(--surface)' : 'var(--muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ theme: 'dark' })}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: `1px solid ${settings.theme === 'dark' ? 'var(--ink)' : 'var(--line)'}`,
                    background: settings.theme === 'dark' ? 'var(--ink)' : 'var(--surface)',
                    color: settings.theme === 'dark' ? 'var(--surface)' : 'var(--muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dark
                </button>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>
                  Omit{' '}
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      padding: '0 4px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    page.
                  </code>{' '}
                  prefix
                </div>
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}
                >
                  Show <code>getByTestId</code> instead of <code>page.getByTestId</code>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.omitPage}
                onChange={(e) => updateSettings({ omitPage: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: 'var(--ink)' }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Tabs — Inspect / Manual + Reset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 57,
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <button
            type="button"
            aria-selected={activeTab === 'inspect'}
            role="tab"
            onClick={() => setActiveTab('inspect')}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: 8,
              border: `1px solid ${activeTab === 'inspect' ? 'var(--ink)' : 'var(--line)'}`,
              background: activeTab === 'inspect' ? 'var(--ink)' : 'var(--surface)',
              color: activeTab === 'inspect' ? 'var(--surface)' : 'var(--muted)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12 }}>⌖</span> Inspect
          </button>
          <button
            type="button"
            aria-selected={activeTab === 'manual'}
            role="tab"
            onClick={() => setActiveTab('manual')}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: 8,
              border: `1px solid ${activeTab === 'manual' ? 'var(--ink)' : 'var(--line)'}`,
              background: activeTab === 'manual' ? 'var(--ink)' : 'var(--surface)',
              color: activeTab === 'manual' ? 'var(--surface)' : 'var(--muted)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            Manual
          </button>
        </div>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset all"
          title="Reset"
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--surface)',
            color: 'var(--muted)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      <div
        style={{
          padding: '16px',
          maxWidth: 360,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          {copied?.startsWith('page.')
            ? `Copied`
            : locators.length
              ? `${locators.length} locators`
              : isInspecting
                ? 'Inspect active'
                : ''}
        </div>

        {activeTab === 'inspect' && (
          <>
            {/* Primary — Linear: pill, shadow, blue when active */}
            <button
              type="button"
              aria-pressed={isInspecting}
              aria-controls="locator-list"
              onClick={toggleInspect}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${isInspecting ? 'var(--accent)' : 'var(--ink)'}`,
                background: isInspecting ? 'var(--accent)' : 'var(--ink)',
                color: '#fff',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)',
                transition: 'all 150ms var(--ease-out-quint)',
              }}
            >
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: '#fff',
                    display: 'inline-block',
                    animation: isInspecting
                      ? 'pulse-dot 1.2s var(--ease-out-quint) infinite'
                      : 'none',
                  }}
                />
                {isInspecting ? 'Inspecting — Click element' : 'Start Inspect'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  opacity: 0.8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.12)',
                }}
              >
                {isInspecting ? 'ESC' : '⌥⇧C'}
              </span>
            </button>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--muted)',
              }}
            >
              <span>
                {isInspecting ? 'Hover highlights • click locks' : 'Opens picker in active tab'}
              </span>
              <span>{isInspecting ? 'crosshair' : 'persistent'}</span>
            </div>

            {isInspecting && !locators.length && (
              <div
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid #bfdbfe',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    fontSize: 12,
                  }}
                >
                  ◎
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>
                    Hover → Click to lock
                  </div>
                  {hoverPreview ? (
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        marginTop: 2,
                        wordBreak: 'break-all',
                      }}
                    >
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                        &lt;{hoverPreview.tag}&gt;
                      </span>{' '}
                      {hoverPreview.text?.slice(0, 36) || (
                        <span style={{ color: '#a1a1aa' }}>no text</span>
                      )}
                      {hoverPreview.id && (
                        <span style={{ color: 'var(--muted)' }}> #{hoverPreview.id}</span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                      }}
                    >
                      Move over page to preview.
                    </div>
                  )}
                </div>
              </div>
            )}

            {!locators.length && !isInspecting && (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 14,
                  }}
                >
                  ◎
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 700,
                    marginTop: 10,
                  }}
                >
                  No selection
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  Start inspect to generate{' '}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: '#f4f4f5',
                      padding: '1px 4px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}
                  >
                    page.getBy*
                  </span>{' '}
                  locators — paste-ready.
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      padding: '4px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    data-testid →
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      padding: '4px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    getByRole →
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      padding: '4px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    getByLabel
                  </span>
                </div>
              </div>
            )}

            {meta && (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    background: 'var(--ink)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  &lt;{meta.tag}&gt;
                </span>
                {meta.id && (
                  <span
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      padding: '2px 6px',
                      borderRadius: 9999,
                      fontSize: 11,
                    }}
                  >
                    #{meta.id}
                  </span>
                )}
                {meta.text && (
                  <span
                    style={{
                      color: 'var(--muted)',
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    &quot;{meta.text.slice(0, 32)}&quot;
                  </span>
                )}
                {url && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new URL(url).hostname}
                  </span>
                )}
              </div>
            )}

            {locators.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}
                  >
                    Locators · {locators.length}
                  </div>
                  <div
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}
                  >
                    first is best
                  </div>
                </div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {locators.map((loc, idx) => (
                    <div
                      key={loc.value + idx}
                      role="listitem"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr 32px',
                        gap: 10,
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderBottom: idx === locators.length - 1 ? '0' : '1px solid var(--line)',
                        borderLeft: idx === 0 ? '3px solid var(--accent)' : '3px solid transparent',
                        background: idx === 0 ? 'var(--accent-soft)' : 'transparent',
                        animation: `sweep-in 200ms var(--ease-out-quint) both`,
                        animationDelay: `${idx * 28}ms`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: idx === 0 ? 'var(--accent)' : 'var(--muted)',
                          background: idx === 0 ? 'var(--surface)' : 'var(--bg)',
                          border: `1px solid ${idx === 0 ? 'var(--accent)' : 'var(--line)'}`,
                          padding: '3px 6px',
                          borderRadius: 6,
                          textAlign: 'center',
                        }}
                      >
                        {loc.kind}
                      </span>
                      <code
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--ink)',
                          wordBreak: 'break-all',
                          lineHeight: 1.4,
                        }}
                      >
                        {renderLocator(loc.value)}
                      </code>
                      <button
                        type="button"
                        aria-label={
                          copied === loc.value
                            ? `Copied ${loc.kind} locator`
                            : `Copy ${loc.kind} locator: ${loc.value}`
                        }
                        onClick={() => copy(loc.value)}
                        title={copied === loc.value ? 'Copied' : 'Copy to clipboard'}
                        style={{
                          width: 28,
                          height: 28,
                          display: 'grid',
                          placeItems: 'center',
                          background: copied === loc.value ? 'var(--ink)' : 'var(--surface)',
                          color: copied === loc.value ? 'var(--surface)' : 'var(--ink)',
                          border: `1px solid ${copied === loc.value ? 'var(--ink)' : 'var(--line)'}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: copied === loc.value ? 'none' : '0 1px 1px rgba(0,0,0,0.04)',
                          transition: 'all 120ms var(--ease-out-quint)',
                        }}
                      >
                        {copied === loc.value ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'manual' && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              overflow: 'visible',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              isolation: 'isolate',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid var(--line)',
                background: 'var(--bg)',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink)',
                }}
              >
                Manual
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
                Test any locator
              </span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={manualLocator}
                    onChange={(e) => setManualLocator(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    setShowSuggestions(true);
                    if (suggestions.length === 0) fetchSuggestions();
                  }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    onKeyDown={(e) => {
                      if (showSuggestions && filteredSuggestions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedSuggestion((prev) => (prev + 1) % filteredSuggestions.length);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedSuggestion(
                            (prev) =>
                              (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length
                          );
                          return;
                        }
                        if (e.key === 'Enter') {
                          if (showSuggestions && filteredSuggestions[selectedSuggestion]) {
                            e.preventDefault();
                            handleSuggestionClick(filteredSuggestions[selectedSuggestion]);
                            return;
                          }
                          handleManualHighlight();
                          return;
                        }
                      }
                      if (e.key === 'Enter') handleManualHighlight();
                      if (e.key === 'Escape') {
                        if (showSuggestions) setShowSuggestions(false);
                        else handleManualClear();
                      }
                    }}
                    placeholder="page.getByTestId('submit') or #my-id"
                    aria-label="Manual locator"
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions && filteredSuggestions.length > 0}
                    aria-controls="manual-suggestions"
                    style={{
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      padding: '9px 10px',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      outline: 'none',
                      minWidth: 0,
                    }}
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div
                      id="manual-suggestions"
                      role="listbox"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
                        zIndex: 50,
                        maxHeight: 200,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                      }}
                    >
                      {filteredSuggestions.map((s, idx) => (
                        <div
                          key={s + idx}
                          role="option"
                          aria-selected={idx === selectedSuggestion}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSuggestionClick(s);
                          }}
                          onMouseEnter={() => setSelectedSuggestion(idx)}
                          style={{
                            padding: '7px 10px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            cursor: 'pointer',
                            background:
                              idx === selectedSuggestion ? 'var(--accent-soft)' : 'transparent',
                            borderLeft:
                              idx === selectedSuggestion
                                ? '2px solid var(--accent)'
                                : '2px solid transparent',
                            color: 'var(--ink)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--muted)',
                              flexShrink: 0,
                              opacity: 0.7,
                            }}
                          >
                            {s.startsWith('page.getByTestId')
                              ? 'testId'
                              : s.startsWith('page.getByRole')
                                ? 'role'
                                : s.startsWith('page.getByText')
                                  ? 'text'
                                  : s.startsWith('#')
                                    ? 'id'
                                    : s.startsWith('.')
                                      ? 'class'
                                      : s.startsWith('//')
                                        ? 'xpath'
                                        : s.startsWith('[')
                                          ? 'css'
                                          : 'locator'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleManualHighlight}
                  disabled={!manualLocator.trim()}
                  aria-label="Highlight"
                  title="Highlight"
                  style={{
                    width: 36,
                    height: 36,
                    display: 'grid',
                    placeItems: 'center',
                    background: manualLocator.trim() ? 'var(--ink)' : 'var(--surface)',
                    color: manualLocator.trim() ? 'var(--surface)' : 'var(--muted)',
                    border: `1px solid ${manualLocator.trim() ? 'var(--ink)' : 'var(--line)'}`,
                    borderRadius: 8,
                    cursor: manualLocator.trim() ? 'pointer' : 'not-allowed',
                    opacity: manualLocator.trim() ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                    <path d="M8 11h6" />
                    <path d="M11 8v6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleManualClear}
                  aria-label="Clear"
                  title="Clear"
                  style={{
                    width: 36,
                    height: 36,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--surface)',
                    color: 'var(--muted)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              {manualResult && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${manualResult.error ? '#fecaca' : manualResult.count > 0 ? '#fde68a' : 'var(--line)'}`,
                    background: manualResult.error
                      ? '#fef2f2'
                      : manualResult.count > 0
                        ? '#fffbeb'
                        : 'var(--bg)',
                    color: manualResult.error
                      ? '#991b1b'
                      : manualResult.count > 0
                        ? '#92400e'
                        : 'var(--muted)',
                  }}
                >
                  {manualResult.error ? (
                    <>✕ {manualResult.error}</>
                  ) : manualResult.count === 0 ? (
                    <>No matches</>
                  ) : (
                    <>Found {manualResult.count} — highlighted</>
                  )}
                </div>
              )}
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--muted)',
                  lineHeight: 1.4,
                }}
              >
                Try:{' '}
                <code
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    padding: '1px 4px',
                    borderRadius: 4,
                  }}
                >
                  #id
                </code>{' '}
                <code
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    padding: '1px 4px',
                    borderRadius: 4,
                  }}
                >
                  .cls
                </code>{' '}
                <code
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    padding: '1px 4px',
                    borderRadius: 4,
                  }}
                >
                  [data-testid=&quot;x&quot;]
                </code>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            paddingTop: 10,
            borderTop: '1px solid var(--line)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>⌥⇧C Toggle</span>
          <span>ESC Cancel</span>
        </div>
      </div>
    </div>
  );
}
