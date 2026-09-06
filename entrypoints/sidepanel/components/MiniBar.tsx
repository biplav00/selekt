import type { Locator, ManualResult, TabId } from '../types';

interface MiniBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  best: Locator | null;
  isInspecting: boolean;
  copied: string | null;
  onCopy: (value: string) => void;
  displayLocator: (value: string) => string;
  manualLocator: string;
  onLocatorChange: (value: string) => void;
  manualResult: ManualResult | null;
  onTestProbe: () => void;
  onReset: () => void;
  onToggleInspect: () => void;
}

export function MiniBar({
  activeTab,
  onSelectTab,
  best,
  isInspecting,
  copied,
  onCopy,
  displayLocator,
  manualLocator,
  onLocatorChange,
  manualResult,
  onTestProbe,
  onReset,
  onToggleInspect,
}: MiniBarProps) {
  // Toggling tabs only switches views — re-clicking the active ⌖ re-arms the pick.
  const pickTab = (tab: TabId) => {
    if (tab === 'inspect' && activeTab === 'inspect') {
      void onToggleInspect();
      return;
    }
    onSelectTab(tab);
  };

  const empty = !best && !isInspecting;
  const codeText = isInspecting
    ? 'scanning…'
    : best
      ? displayLocator(best.value)
      : 'pick an element…';
  const isCopied = !!best && copied === best.value;

  const segBtn = (tab: TabId, label: string, title: string) => {
    const selected = activeTab === tab;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={() => pickTab(tab)}
        title={title}
        aria-label={title}
        style={{
          border: 0,
          background: selected ? 'var(--ink)' : 'transparent',
          borderRadius: 9999,
          width: 28,
          height: 28,
          cursor: 'pointer',
          color: selected ? 'var(--bg)' : 'var(--muted)',
          fontSize: 13,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {label}
      </button>
    );
  };

  const iconBtn: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 9999,
    border: '1px solid var(--line)',
    background: 'var(--panel)',
    color: 'var(--ink)',
    cursor: 'pointer',
    fontSize: 13,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  };

  return (
    <div>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line-strong)',
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 6px 5px 5px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: isInspecting || best ? 'var(--sig)' : 'var(--line-strong)',
            marginLeft: 5,
            flexShrink: 0,
            animation: isInspecting ? 'led-blink 1s steps(2) infinite' : 'none',
          }}
        />
        <div
          role="tablist"
          aria-label="Mini mode"
          style={{
            display: 'flex',
            background: 'var(--bg)',
            borderRadius: 9999,
            padding: 2,
            flexShrink: 0,
          }}
        >
          {segBtn('inspect', '⌖', 'Pick element')}
          {segBtn('manual', '⌕', 'Manual probe')}
        </div>
        {activeTab === 'inspect' ? (
          <>
            <code
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--font-code)',
                fontSize: 11.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: empty ? 'var(--muted-2)' : 'var(--ink)',
              }}
            >
              {codeText}
            </code>
            <button
              type="button"
              onClick={() => best && onCopy(best.value)}
              disabled={empty}
              aria-label={isCopied ? 'Copied locator' : 'Copy locator'}
              title={isCopied ? 'Copied' : 'Copy'}
              style={{
                ...iconBtn,
                opacity: empty ? 0.4 : 1,
                cursor: empty ? 'not-allowed' : 'pointer',
                background: isCopied ? 'var(--ink)' : 'var(--panel)',
                color: isCopied ? 'var(--bg)' : 'var(--ink)',
              }}
            >
              {isCopied ? '✓' : '⎘'}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={manualLocator}
              onChange={(event) => onLocatorChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onTestProbe();
                }
              }}
              aria-label="Manual locator"
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--font-code)',
                fontSize: 11.5,
                border: 0,
                background: 'transparent',
                outline: 'none',
                color: 'var(--ink)',
                padding: 0,
              }}
            />
            <button
              type="button"
              onClick={onTestProbe}
              disabled={!manualLocator.trim()}
              aria-label="Test probe"
              title="Test"
              style={{
                ...iconBtn,
                background: manualLocator.trim() ? 'var(--ink)' : 'var(--panel)',
                color: manualLocator.trim() ? 'var(--bg)' : 'var(--muted)',
                border: `1px solid ${manualLocator.trim() ? 'var(--ink)' : 'var(--line)'}`,
                opacity: manualLocator.trim() ? 1 : 0.5,
                cursor: manualLocator.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              ▸
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset all"
          title="Reset"
          style={iconBtn}
        >
          ↺
        </button>
      </div>
      {activeTab === 'manual' && manualResult && (
        <div
          role="status"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: manualResult.error ? 'var(--err-ink)' : 'var(--muted)',
            marginTop: 6,
            padding: '0 4px',
          }}
        >
          {manualResult.error
            ? `✕ ${manualResult.error}`
            : manualResult.count === 0
              ? 'No matches'
              : `▸ ${manualResult.count} match${manualResult.count === 1 ? '' : 'es'} — highlighted`}
        </div>
      )}
    </div>
  );
}
