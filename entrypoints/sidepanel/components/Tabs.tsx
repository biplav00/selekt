import type { TabId } from '../types';

interface TabsProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  onReset: () => void;
}

export function Tabs({ activeTab, onSelect, onReset }: TabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
        position: 'sticky',
        top: 57,
        zIndex: 1,
      }}
    >
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        <button
          type="button"
          aria-selected={activeTab === 'inspect'}
          role="tab"
          onClick={() => onSelect('inspect')}
          style={{
            flex: 1,
            padding: '7px 10px',
            borderRadius: 8,
            border: `1px solid ${activeTab === 'inspect' ? 'var(--ink)' : 'var(--line)'}`,
            background: activeTab === 'inspect' ? 'var(--ink)' : 'var(--surface)',
            color: activeTab === 'inspect' ? 'var(--surface)' : 'var(--muted)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 12 }}>⌖</span> Inspect
        </button>
        <button
          type="button"
          aria-selected={activeTab === 'manual'}
          role="tab"
          onClick={() => onSelect('manual')}
          style={{
            flex: 1,
            padding: '7px 10px',
            borderRadius: 8,
            border: `1px solid ${activeTab === 'manual' ? 'var(--ink)' : 'var(--line)'}`,
            background: activeTab === 'manual' ? 'var(--ink)' : 'var(--surface)',
            color: activeTab === 'manual' ? 'var(--surface)' : 'var(--muted)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Manual
        </button>
      </div>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset all"
        title="Reset"
        style={{
          width: 32,
          height: 32,
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
    </div>
  );
}
