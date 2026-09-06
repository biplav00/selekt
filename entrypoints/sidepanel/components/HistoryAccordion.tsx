import { useState, type ReactNode } from 'react';

interface HistoryAccordionProps {
  title: string;
  count: number;
  onClear: () => void;
  children: ReactNode;
}

export function HistoryAccordion({ title, count, onClear, children }: HistoryAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 4px 4px 12px',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: '8px 0',
            color: 'var(--ink)',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              borderRadius: 9999,
              padding: '1px 8px',
            }}
          >
            {count}
          </span>
          <span
            aria-hidden="true"
            style={{
              marginLeft: 'auto',
              color: 'var(--muted)',
              display: 'grid',
              placeItems: 'center',
              transform: open ? 'none' : 'rotate(-90deg)',
              transition: 'transform 180ms var(--ease-out-quint)',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${title.toLowerCase()}`}
            title="Clear history"
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '5px 9px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <div
          style={{
            borderTop: '1px solid var(--line)',
            maxHeight: 260,
            overflowY: 'auto',
            animation: 'rise-in 0.25s var(--ease-out-quint)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
