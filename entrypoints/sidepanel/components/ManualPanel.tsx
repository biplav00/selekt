import { useState, type KeyboardEvent } from 'react';
import type { ManualAttempt, ManualResult } from '../types';
import { HistoryAccordion } from './HistoryAccordion';

interface ManualPanelProps {
  manualLocator: string;
  onLocatorChange: (value: string) => void;
  manualResult: ManualResult | null;
  onHighlight: () => void;
  onClear: () => void;
  onCopy: (value: string) => void;
  copied: string | null;
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
}

export function ManualPanel({
  manualLocator,
  onLocatorChange,
  manualResult,
  onHighlight,
  onClear,
  onCopy,
  copied,
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
}: ManualPanelProps) {
  const [isFocused, setIsFocused] = useState(false);

  const filteredSuggestions = (() => {
    const query = manualLocator.trim().toLowerCase();
    if (!query) return suggestions.slice(0, 8);
    return suggestions.filter((s) => s.toLowerCase().includes(query)).slice(0, 8);
  })();

  const verdictClass = manualResult?.error
    ? 'verdict verdict--err'
    : manualResult && manualResult.count > 0
      ? 'verdict verdict--ok'
      : 'verdict';

  const commitOrComplete = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
      // Field-level Escape must not also bubble out to the global
      // inspect-cancel (or the settings dialog): one Escape, one action.
      event.stopPropagation();
      if (showSuggestions) onShowSuggestions(false);
      else onClear();
    }
  };

  return (
    <>
      <div className="card card--overlay">
        <div className="card-head">
          <span className="label">Manual probe</span>
          <span className="label label--muted">any selector</span>
        </div>
        <div className="card-body">
          <div className="probe-wrap">
            <textarea
              value={manualLocator}
              rows={4}
              onChange={(event) => onLocatorChange(event.target.value)}
              onFocus={() => {
                onShowSuggestions(true);
                if (suggestions.length === 0) onFetchSuggestions();
              }}
              onBlur={() => {
                setTimeout(() => onShowSuggestions(false), 150);
              }}
              onKeyDown={commitOrComplete}
              aria-label="Manual locator"
              aria-autocomplete="list"
              aria-expanded={isFocused && showSuggestions && filteredSuggestions.length > 0}
              aria-controls="manual-suggestions"
              spellCheck={false}
              className="probe-input"
              onFocusCapture={() => setIsFocused(true)}
              onBlurCapture={() => setIsFocused(false)}
            />
            {isFocused && showSuggestions && filteredSuggestions.length > 0 && (
              <div id="manual-suggestions" role="listbox" className="suggest">
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
                    className={`suggest-item${idx === selectedSuggestion ? ' is-selected' : ''}`}
                  >
                    <span className="suggest-text">{displayLocator(suggestion)}</span>
                    <span className="suggest-kind">
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
          <div className="actions-row">
            <button
              type="button"
              onClick={onHighlight}
              disabled={!manualLocator.trim()}
              className="btn-primary"
            >
              <svg
                width="16"
                height="16"
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
              <span className="btn-key">↵</span>
            </button>
            <button
              type="button"
              onClick={() => onCopy(manualLocator)}
              disabled={!manualLocator.trim()}
              aria-label={copied === manualLocator ? 'Copied' : 'Copy manual locator'}
              title={copied === manualLocator ? 'Copied' : 'Copy to clipboard'}
              className={`icon-btn icon-btn--lg${copied === manualLocator ? ' is-active' : ''}`}
            >
              {copied === manualLocator ? (
                <svg
                  width="16"
                  height="16"
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
                  width="16"
                  height="16"
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
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear"
              title="Clear"
              className="icon-btn icon-btn--lg"
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
            <div role="status" aria-live="polite" className={verdictClass}>
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
          <div className="hint">↵ tests · ⇧↵ new line · ↑↓ suggestions</div>
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
              className="row-btn"
            >
              <code className="code code--sm code--ellipsis row-code">
                {displayLocator(attempt.query)}
              </code>
              <span
                className={`stat${
                  attempt.error ? ' stat--err' : attempt.count > 0 ? ' stat--ok' : ' stat--muted'
                }`}
              >
                {attempt.error ? '✕' : attempt.count === 0 ? '0' : `▸ ${attempt.count}`}
              </span>
              <span className="time">{attempt.time}</span>
            </button>
          ))}
        </HistoryAccordion>
      )}
    </>
  );
}
