import { useState } from 'react';
import type { ManualResult } from '../types';

interface ManualPanelProps {
  manualLocator: string;
  onLocatorChange: (value: string) => void;
  manualResult: ManualResult | null;
  onHighlight: () => void;
  onClear: () => void;
  suggestions: string[];
  showSuggestions: boolean;
  selectedSuggestion: number;
  onSuggestionClick: (value: string) => void;
  onSuggestionHover: (index: number) => void;
  onShowSuggestions: (show: boolean) => void;
  onSelectedSuggestionChange: (index: number) => void;
  onFetchSuggestions: () => void;
}

export function ManualPanel({
  manualLocator,
  onLocatorChange,
  manualResult,
  onHighlight,
  onClear,
  suggestions,
  showSuggestions,
  selectedSuggestion,
  onSuggestionClick,
  onSuggestionHover,
  onShowSuggestions,
  onSelectedSuggestionChange,
  onFetchSuggestions,
}: ManualPanelProps) {
  const [isFocused, setIsFocused] = useState(false);

  const filteredSuggestions = (() => {
    const query = manualLocator.trim().toLowerCase();
    if (!query) return suggestions.slice(0, 8);
    return suggestions.filter((s) => s.toLowerCase().includes(query)).slice(0, 8);
  })();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'visible', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', isolation: 'isolate' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--line)', background: 'var(--bg)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)' }}>Manual</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>Test any locator</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={manualLocator}
              onChange={(event) => onLocatorChange(event.target.value)}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = 'var(--accent)';
                onShowSuggestions(true);
                if (suggestions.length === 0) onFetchSuggestions();
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = 'var(--line)';
                setTimeout(() => onShowSuggestions(false), 150);
              }}
              onKeyDown={(event) => {
                if (showSuggestions && filteredSuggestions.length > 0) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    onSelectedSuggestionChange((selectedSuggestion + 1) % filteredSuggestions.length);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    onSelectedSuggestionChange((selectedSuggestion - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                    return;
                  }
                  if (event.key === 'Enter') {
                    if (showSuggestions && filteredSuggestions[selectedSuggestion]) {
                      event.preventDefault();
                      onSuggestionClick(filteredSuggestions[selectedSuggestion]);
                      return;
                    }
                    onHighlight();
                    return;
                  }
                }
                if (event.key === 'Enter') onHighlight();
                if (event.key === 'Escape') {
                  if (showSuggestions) onShowSuggestions(false);
                  else onClear();
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
                border: `1px solid ${isFocused ? 'var(--accent)' : 'var(--line)'}`,
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--ink)',
                outline: 'none',
                minWidth: 0,
              }}
              onFocusCapture={() => setIsFocused(true)}
              onBlurCapture={() => setIsFocused(false)}
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
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion + String(idx)}
                    role="option"
                    aria-selected={idx === selectedSuggestion}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSuggestionClick(suggestion);
                    }}
                    onMouseEnter={() => onSelectedSuggestionChange(idx)}
                    style={{
                      padding: '7px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                      background: idx === selectedSuggestion ? 'var(--accent-soft)' : 'transparent',
                      borderLeft: idx === selectedSuggestion ? '2px solid var(--accent)' : '2px solid transparent',
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
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, opacity: 0.7 }}>
                      {suggestion.startsWith('page.getByTestId')
                        ? 'testId'
                        : suggestion.startsWith('page.getByRole')
                          ? 'role'
                          : suggestion.startsWith('page.getByText')
                            ? 'text'
                            : suggestion.startsWith('#')
                              ? 'id'
                              : suggestion.startsWith('.')
                                ? 'class'
                                : suggestion.startsWith('//')
                                  ? 'xpath'
                                  : suggestion.startsWith('[')
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
            onClick={onHighlight}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <path d="M8 11h6" />
              <path d="M11 8v6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClear}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              background: manualResult.error ? '#fef2f2' : manualResult.count > 0 ? '#fffbeb' : 'var(--bg)',
              color: manualResult.error ? '#991b1b' : manualResult.count > 0 ? '#92400e' : 'var(--muted)',
            }}
          >
            {manualResult.error ? <>✕ {manualResult.error}</> : manualResult.count === 0 ? <>No matches</> : <>Found {manualResult.count} — highlighted</>}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>
          Try: <code style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '1px 4px', borderRadius: 4 }}>#id</code>{' '}
          <code style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '1px 4px', borderRadius: 4 }}>.cls</code>{' '}
          <code style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '1px 4px', borderRadius: 4 }}>[data-testid=&quot;x&quot;]</code>
        </div>
      </div>
    </div>
  );
}
