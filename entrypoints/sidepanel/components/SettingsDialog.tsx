import { useEffect, useRef } from 'react';
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'color-mix(in srgb, var(--ink) 40%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        animation: 'rise-in 0.15s var(--ease-out-quint)',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            id="settings-title"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Calibration
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              width: 28,
              height: 28,
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '8px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Shift</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
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
            style={{
              width: 58,
              height: 30,
              borderRadius: 9999,
              background: isNight ? 'var(--sig)' : 'var(--panel-deep)',
              border: '1px solid var(--line-strong)',
              position: 'relative',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 200ms var(--ease-out-quint)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 24,
                height: 24,
                borderRadius: 9999,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--ink)',
                transform: isNight ? 'translateX(28px)' : 'none',
                transition: 'transform 220ms var(--ease-out-quint)',
              }}
            >
              {isNight ? (
                <svg
                  width="13"
                  height="13"
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
                  width="13"
                  height="13"
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
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 8,
          }}
        >
          <div id="omit-label">
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              Omit{' '}
              <code
                style={{
                  fontFamily: 'var(--font-code)',
                  background: 'var(--panel)',
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
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
            style={{
              width: 48,
              height: 26,
              borderRadius: 9999,
              background: settings.omitPage ? 'var(--sig)' : 'var(--panel-deep)',
              border: '1px solid var(--line-strong)',
              position: 'relative',
              cursor: 'pointer',
              flexShrink: 0,
              alignSelf: 'center',
              transition: 'background 200ms var(--ease-out-quint)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 20,
                height: 20,
                borderRadius: 9999,
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                transform: settings.omitPage ? 'translateX(22px)' : 'none',
                transition: 'transform 220ms var(--ease-out-quint)',
              }}
            />
          </button>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--muted)',
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--line)',
            paddingTop: 10,
          }}
        >
          <span>ESC closes</span>
          <span>click outside dismisses</span>
        </div>
      </div>
    </div>
  );
}
