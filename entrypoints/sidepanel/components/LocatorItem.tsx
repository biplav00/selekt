import type { Locator } from '../types';

interface LocatorItemProps {
  locator: Locator;
  isBest: boolean;
  channel: string;
  isCopied: boolean;
  onCopy: (value: string) => void;
  displayValue: string;
}

export function LocatorItem({
  locator,
  isBest,
  channel,
  isCopied,
  onCopy,
  displayValue,
}: LocatorItemProps) {
  const renderLocator = (value: string) => {
    const match = value.match(/^(page\.)?(getBy\w+|locator)(.*)$/);
    if (!match) return <>{value}</>;
    const hasPage = !!match[1];
    return (
      <>
        {hasPage && <span className="dim">{match[1]}</span>}
        <span className="fn">{match[2]}</span>
        <span className="dim">{match[3]}</span>
      </>
    );
  };

  return (
    <div role="listitem" className={`loc-row${isBest ? ' is-best' : ''}`}>
      <div className="min-w-0">
        <div className="loc-kind">
          <span aria-hidden="true" className="loc-led" />
          {locator.kind}
          {isBest && <span>· {channel} BEST</span>}
        </div>
        <code className="loc-code">{renderLocator(displayValue)}</code>
      </div>
      <button
        type="button"
        aria-label={
          isCopied
            ? `Copied ${locator.kind} locator`
            : `Copy ${locator.kind} locator: ${displayValue}`
        }
        onClick={() => onCopy(locator.value)}
        title={isCopied ? 'Copied' : 'Copy to clipboard'}
        className={`icon-btn icon-btn--md${isCopied ? ' is-active' : ''}`}
      >
        {isCopied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
          </svg>
        )}
      </button>
    </div>
  );
}
