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
    <div className="card">
      <div className="acc-head">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="acc-toggle"
        >
          <span className="label label--muted">{title}</span>
          <span className="count-badge">{count}</span>
          <span aria-hidden="true" className={`acc-chev${open ? ' is-open' : ''}`}>
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
            className="acc-clear"
          >
            Clear
          </button>
        )}
      </div>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}
