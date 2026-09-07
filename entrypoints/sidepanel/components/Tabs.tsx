import type { TabId } from '../types';

interface TabsProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  onReset: () => void;
}

export function Tabs({ activeTab, onSelect, onReset }: TabsProps) {
  return (
    <div className="tabs-wrap">
      <div role="tablist" aria-label="Panel mode" className="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inspect'}
          onClick={() => onSelect('inspect')}
          className={`tab${activeTab === 'inspect' ? ' is-active' : ''}`}
        >
          <span aria-hidden="true" className="tab-glyph">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="6" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </span>{' '}
          Inspect
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'manual'}
          onClick={() => onSelect('manual')}
          className={`tab${activeTab === 'manual' ? ' is-active' : ''}`}
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
          className="tabs-reset"
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
