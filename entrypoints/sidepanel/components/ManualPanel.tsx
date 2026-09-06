import { useState } from 'react';
import type { ManualAttempt, ManualResult } from '../types';
import { HistoryAccordion } from './HistoryAccordion';

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
  history: ManualAttempt[];
  onSelectEntry: (query: string) => void;
  onClearHistory: () => void;
  displayLocator: (value: string) => string;
  compact: boolean;
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
  history,
  onSelectEntry,
  onClearHistory,
  displayLocator,
  compact,
}: ManualPanelProps) {
  const [isFocused, setIsFocused] = useState(false);

  const filteredSuggestions = (() => {
    const query = manualLocator.trim().toLowerCase();
    if (!query) return suggestions.slice(0, 8);
    return suggestions.filter((s) => s.toLowerCase().includes(query)).slice(0, 8);
  })();

  const verdictTone = manualResult?.error
    ? { bg: 'var(--err-bg)', line: 'var(--err-line)', ink: 'var(--err-ink)' }
    : manualResult && manualResult.count > 0
      ? { bg: 'var(--warn-bg)', line: 'var(--warn-line)', ink: 'var(--warn-ink)' }
      : { bg: 'var(--bg)', line: 'var(--line)', ink: 'var(--muted)' };

  const commitOrComplete = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        onSelectedSuggestionChange((selectedSuggestion + 1) % filteredSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        onSelectedSuggestionChange(
          (selectedSuggestion - 1 + filteredSuggestions.length) % filteredSuggestions.length
        );
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (showSuggestions && filteredSuggestions[selectedSuggestion]) {
        onSuggestionClick(filteredSuggestions[selectedSuggestion]);
        return;
      }
      onHighlight();
    }
    if (event.key === 'Escape') {
      if (showSuggestions) onShowSuggestions(false);
      else onClear();
    }
  };

  return (
    <>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          overflow: 'visible',
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
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Manual probe
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
            any selector
          </span>
        </div>
        <div
          style={{
            padding: compact ? 9 : 12,
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? 8 : 10,
          }}
        >
          <div style={{ position: 'relative' }}>
            <textarea
              value={manualLocator}
              rows={compact ? 2 : 4}
              onChange={(event) => onLocatorChange(event.target.value)}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = 'var(--sig-deep)';
                onShowSuggestions(true);
                if (suggestions.length === 0) onFetchSuggestions();
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = 'var(--line)';
                setTimeout(() => onShowSuggestions(false), 150);
              }}
              onKeyDown={commitOrComplete}
              aria-label="Manual locator"
              aria-autocomplete="list"
              aria-expanded={isFocused && showSuggestions && filteredSuggestions.length > 0}
              aria-controls="manual-suggestions"
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: compact ? 64 : 104,
                resize: 'vertical',
                fontFamily: 'var(--font-code)',
                fontSize: 13,
                lineHeight: 1.6,
                padding: '10px 12px',
                border: `1px solid ${isFocused ? 'var(--sig-deep)' : 'var(--line)'}`,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                outline: 'none',
                display: 'block',
              }}
              onFocusCapture={() => setIsFocused(true)}
              onBlurCapture={() => setIsFocused(false)}
            />
            {isFocused && showSuggestions && filteredSuggestions.length > 0 && (
              <div
                id="manual-suggestions"
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
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
                    onMouseEnter={() => onSuggestionHover(idx)}
                    style={{
                      padding: '7px 10px',
                      fontFamily: 'var(--font-code)',
                      fontSize: 11,
                      cursor: 'pointer',
                      background: idx === selectedSuggestion ? 'var(--sig-soft)' : 'transparent',
                      borderLeft:
                        idx === selectedSuggestion
                          ? '2px solid var(--sig)'
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
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {displayLocator(suggestion)}
                    </span>
                    <span
                      style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, opacity: 0.7 }}
                    >
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
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={onHighlight}
              disabled={!manualLocator.trim()}
              style={{
                flex: 1,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: manualLocator.trim() ? 'var(--bar)' : 'var(--panel)',
                color: manualLocator.trim() ? 'var(--bar-ink)' : 'var(--muted)',
                border: `1px solid ${manualLocator.trim() ? 'var(--bar)' : 'var(--line)'}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: manualLocator.trim() ? 'pointer' : 'not-allowed',
                opacity: manualLocator.trim() ? 1 : 0.6,
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6" />
                <path d="M11 8v6" />
              </svg>
              Test probe
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 400,
                  opacity: 0.7,
                }}
              >
                ↵
              </span>
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear"
              title="Clear"
              style={{
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--panel)',
                color: 'var(--muted)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
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
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${verdictTone.line}`,
                background: verdictTone.bg,
                color: verdictTone.ink,
              }}
            >
              {manualResult.error ? (
                <>✕ {manualResult.error}</>
              ) : manualResult.count === 0 ? (
                <>No matches</>
              ) : (
                <>
                  ▸ {manualResult.count} match{manualResult.count === 1 ? '' : 'es'} — highlighted
                </>
              )}
            </div>
          )}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--muted)',
              lineHeight: 1.5,
            }}
          >
            ↵ tests · ⇧↵ new line · ↑↓ suggestions
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <HistoryAccordion title="Probe history" count={history.length} onClear={onClearHistory}>
          {history.map((attempt, i) => (
            <button
              key={attempt.time + String(i)}
              type="button"
              onClick={() => onSelectEntry(attempt.query)}
              title="Re-run this probe"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '9px 12px',
                background: 'transparent',
                border: 0,
                borderBottom:
                  i < history.length - 1 ? '1px solid var(--line)' : '1px solid transparent',
                cursor: 'pointer',
                color: 'var(--ink)',
                font: 'inherit',
                textAlign: 'left',
              }}
            >
              <code
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: 'var(--font-code)',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayLocator(attempt.query)}
              </code>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: attempt.error
                    ? 'var(--err-ink)'
                    : attempt.count > 0
                      ? 'var(--ok)'
                      : 'var(--muted)',
                }}
              >
                {attempt.error ? '✕' : attempt.count === 0 ? '0' : `▸ ${attempt.count}`}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {attempt.time}
              </span>
            </button>
          ))}
        </HistoryAccordion>
      )}
    </>
  );
}
