import { useEffect, useRef, type ReactNode } from 'react';
import type { Settings } from '../types';

interface SettingsDialogProps {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
}

function SettingRow({ children }: { children: ReactNode }) {
  return <div className="setting-row">{children}</div>;
}

export function SettingsDialog({ settings, onUpdate, onClose }: SettingsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the dialog on open; return focus to the gear button on close.
  useEffect(() => {
    closeRef.current?.focus();
    return () => {
      document.getElementById('settings-btn')?.focus();
    };
  }, []);

  // ESC closes (capture + stop so the global inspect-cancel never fires);
  // Tab is trapped inside the dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const items = focusables(panelRef.current);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const isNight = settings.theme === 'dark';
  const flipShift = () => onUpdate({ theme: isNight ? 'light' : 'dark' });

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="dialog"
      >
        <div className="dialog-head">
          <span id="settings-title" className="label">
            Calibration
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="icon-btn"
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

        <SettingRow>
          <div>
            <div className="setting-title">Shift</div>
            <div className="setting-sub">
              {isNight ? 'Night bench · dark' : 'Day steel · light'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isNight}
            aria-label="Color shift"
            title={isNight ? 'Switch to day shift' : 'Switch to night shift'}
            onClick={flipShift}
            className="switch"
          >
            <span aria-hidden="true" className="switch-knob">
              {isNight ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </span>
          </button>
        </SettingRow>

        <SettingRow>
          <div id="omit-label">
            <div className="setting-title">
              Omit <code className="setting-code">page.</code> prefix
            </div>
            <div className="setting-sub">
              Copy <code>getByTestId</code> instead of <code>page.getByTestId</code>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.omitPage}
            aria-labelledby="omit-label"
            title={settings.omitPage ? 'Include page. prefix' : 'Omit page. prefix'}
            onClick={() => onUpdate({ omitPage: !settings.omitPage })}
            className="switch"
          >
            <span aria-hidden="true" className="switch-knob" />
          </button>
        </SettingRow>

        <div className="dialog-foot">
          <span>ESC closes</span>
          <span>click outside dismisses</span>
        </div>
      </div>
    </div>
  );
}
