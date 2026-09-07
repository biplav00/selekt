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
  const live = isInspecting || locatorCount > 0;

  return (
    <div className="bar">
      <span
        aria-hidden="true"
        className={`led${live ? ' is-live' : ''}${isInspecting ? ' is-blink' : ''}`}
      />
      <div className="brand">
        <div className="brand-name">SELEKT</div>
        <div role="status" aria-live="polite" className="brand-sub">
          {readout}
        </div>
      </div>
      {host && (
        <span title={host} className="host">
          {host}
        </span>
      )}
      <button
        type="button"
        onClick={onMinimize}
        aria-label="Minimize to floating dialog"
        title="Floating dialog"
        className="icon-btn icon-btn--onbar"
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
        className={`icon-btn icon-btn--onbar${showSettings ? ' is-active' : ''}`}
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
