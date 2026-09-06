import type { CSSProperties } from 'react';
import type { TabId } from '../types';

interface TabsProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  onReset: () => void;
}

function tabStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '8px 6px',
    borderRadius: 6,
    border: 0,
    background: active ? 'var(--bar)' : 'transparent',
    color: active ? 'var(--bar-ink)' : 'var(--muted)',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };
}

export function Tabs({ activeTab, onSelect, onReset }: TabsProps) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
        position: 'sticky',
        top: 57,
        zIndex: 1,
      }}
    >
      <div
        role="tablist"
        aria-label="Panel mode"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 4,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 4,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inspect'}
          onClick={() => onSelect('inspect')}
          style={tabStyle(activeTab === 'inspect')}
        >
          <span aria-hidden="true" style={{ fontSize: 12 }}>
            ⌖
          </span>{' '}
          Inspect
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'manual'}
          onClick={() => onSelect('manual')}
          style={tabStyle(activeTab === 'manual')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Manual
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset all"
          title="Reset"
          style={{
            width: 36,
            display: 'grid',
            placeItems: 'center',
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
