import type { Locator } from '../types';

interface LocatorItemProps {
  locator: Locator;
  isBest: boolean;
  isCopied: boolean;
  onCopy: (value: string) => void;
  displayValue: string;
}

export function LocatorItem({ locator, isBest, isCopied, onCopy, displayValue }: LocatorItemProps) {
  const renderLocator = (value: string) => {
    const match = value.match(/^(page\.)?(getBy\w+|locator)(.*)$/);
    if (!match) return <>{value}</>;
    const hasPage = !!match[1];
    return (
      <>
        {hasPage && <span style={{ color: '#71717a' }}>{match[1]}</span>}
        <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{match[2]}</span>
        <span style={{ color: 'var(--muted)' }}>{match[3]}</span>
      </>
    );
  };

  return (
    <div
      role="listitem"
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr 32px',
        gap: 10,
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid var(--line)',
        borderLeft: isBest ? '3px solid var(--accent)' : '3px solid transparent',
        background: isBest ? 'var(--accent-soft)' : 'transparent',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: isBest ? 'var(--accent)' : 'var(--muted)',
          background: isBest ? 'var(--surface)' : 'var(--bg)',
          border: `1px solid ${isBest ? 'var(--accent)' : 'var(--line)'}`,
          padding: '3px 6px',
          borderRadius: 6,
          textAlign: 'center',
        }}
      >
        {locator.kind}
      </span>
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink)',
          wordBreak: 'break-all',
          lineHeight: 1.4,
        }}
      >
        {renderLocator(displayValue)}
      </code>
      <button
        type="button"
        aria-label={isCopied ? `Copied ${locator.kind} locator` : `Copy ${locator.kind} locator: ${displayValue}`}
        onClick={() => onCopy(locator.value)}
        title={isCopied ? 'Copied' : 'Copy to clipboard'}
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: isCopied ? 'var(--ink)' : 'var(--surface)',
          color: isCopied ? 'var(--surface)' : 'var(--ink)',
          border: `1px solid ${isCopied ? 'var(--ink)' : 'var(--line)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: isCopied ? 'none' : '0 1px 1px rgba(0,0,0,0.04)',
          transition: 'all 120ms var(--ease-out-quint)',
        }}
      >
        {isCopied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
          </svg>
        )}
      </button>
    </div>
  );
}
