interface HeaderProps {
  onToggleSettings: () => void;
  showSettings: boolean;
}

export function Header({ onToggleSettings, showSettings }: HeaderProps) {
  return (
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
          onClick={onToggleSettings}
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
  );
}
