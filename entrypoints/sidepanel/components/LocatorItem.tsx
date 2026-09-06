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
        {hasPage && <span style={{ color: 'var(--muted)' }}>{match[1]}</span>}
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{match[2]}</span>
        <span style={{ color: 'var(--muted)' }}>{match[3]}</span>
      </>
    );
  };

  return (
    <div
      role="listitem"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 30px',
        gap: 10,
        alignItems: 'center',
        padding: '11px 12px',
        borderBottom: '1px solid var(--line)',
        borderLeft: isBest ? '4px solid var(--sig)' : '4px solid transparent',
        background: isBest ? 'var(--sig-soft)' : 'transparent',
        animation: 'rise-in 0.3s var(--ease-out-quint)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isBest ? 'var(--sig-deep)' : 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 9999,
              background: isBest ? 'var(--sig)' : 'var(--line-strong)',
              flexShrink: 0,
            }}
          />
          {locator.kind}
          {isBest && <span>· {channel} BEST</span>}
        </div>
        <code
          style={{
            fontFamily: 'var(--font-code)',
            fontSize: 11.5,
            color: 'var(--ink)',
            wordBreak: 'break-all',
            lineHeight: 1.5,
            display: 'block',
            marginTop: 3,
          }}
        >
          {renderLocator(displayValue)}
        </code>
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
        style={{
          width: 30,
          height: 30,
          display: 'grid',
          placeItems: 'center',
          background: isCopied ? 'var(--bar)' : 'var(--panel)',
          color: isCopied ? 'var(--bar-ink)' : 'var(--ink)',
          border: `1px solid ${isCopied ? 'var(--bar)' : 'var(--line)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 120ms var(--ease-out-quint)',
        }}
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
