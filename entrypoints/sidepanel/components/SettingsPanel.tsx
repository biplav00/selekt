import type { Settings } from '../types';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onUpdate, onClose }: SettingsPanelProps) {
  return (
    <div style={{ padding: '12px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700 }}>Settings</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>Theme</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{settings.theme === 'dark' ? 'Dark' : 'Light'} • Linear Clean</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => onUpdate({ theme: 'light' })}
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
              onClick={() => onUpdate({ theme: 'dark' })}
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

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>
              Omit <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '0 4px', borderRadius: 4, fontSize: 11 }}>page.</code> prefix
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
              Show <code>getByTestId</code> instead of <code>page.getByTestId</code>
            </div>
          </div>
          <input type="checkbox" checked={settings.omitPage} onChange={(event) => onUpdate({ omitPage: event.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--ink)' }} />
        </label>
      </div>
    </div>
  );
}
