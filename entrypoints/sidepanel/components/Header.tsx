interface HeaderProps {
  onToggleSettings: () => void;
  showSettings: boolean;
  isInspecting: boolean;
  locatorCount: number;
  host: string;
  onMinimize: () => void;
}

export function Header({
  onToggleSettings,
  showSettings,
  isInspecting,
  locatorCount,
  host,
  onMinimize,
}: HeaderProps) {
  const readout = isInspecting
    ? 'SCAN · hover page'
    : locatorCount > 0
      ? `LOCKED · ${locatorCount} locator${locatorCount === 1 ? '' : 's'}`
      : 'IDLE · v0.1.0';

  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'var(--bar)',
        color: 'var(--bar-ink)',
        position: 'sticky',
        top: 0,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 9,
          height: 9,
          borderRadius: 9999,
          flexShrink: 0,
          background: isInspecting || locatorCount > 0 ? 'var(--sig)' : 'var(--muted-2)',
          animation: isInspecting ? 'led-blink 1s steps(2) infinite' : 'none',
          boxShadow:
            isInspecting || locatorCount > 0
              ? '0 0 0 3px color-mix(in srgb, var(--sig) 25%, transparent)'
              : 'none',
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.04em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          SELEKT
        </div>
        <div
          role="status"
          aria-live="polite"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            opacity: 0.75,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {readout}
        </div>
      </div>
      {host && (
        <span
          title={host}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            opacity: 0.75,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 120,
            flexShrink: 0,
          }}
        >
          {host}
        </span>
      )}
      <button
        type="button"
        onClick={onMinimize}
        aria-label="Minimize to floating dialog"
        title="Floating dialog"
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: 'transparent',
          color: 'var(--bar-ink)',
          border: '1px solid color-mix(in srgb, var(--bar-ink) 30%, transparent)',
          borderRadius: 8,
          cursor: 'pointer',
          flexShrink: 0,
          opacity: 0.75,
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
          <path d="M8 3H5a2 2 0 0 0-2 2v4" />
          <path d="M16 3h4a2 2 0 0 1 2 2v4" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-4" />
          <path d="M16 21h4a2 2 0 0 0 2-2v-4" />
        </svg>
      </button>
      <button
        type="button"
        id="settings-btn"
        onClick={onToggleSettings}
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={showSettings}
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: showSettings ? 'var(--bar-ink)' : 'transparent',
          color: showSettings ? 'var(--bar)' : 'var(--bar-ink)',
          border: '1px solid color-mix(in srgb, var(--bar-ink) 30%, transparent)',
          borderRadius: 8,
          cursor: 'pointer',
          flexShrink: 0,
          opacity: showSettings ? 1 : 0.75,
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
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );
}
