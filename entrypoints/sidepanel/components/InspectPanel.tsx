import { useState } from 'react';
import type { Locator, Meta, PickerSnapshot } from '../types';
import { HistoryAccordion } from './HistoryAccordion';
import { LocatorItem } from './LocatorItem';

interface InspectPanelProps {
  isInspecting: boolean;
  locators: Locator[];
  meta: Meta | null;
  hoverPreview: Meta | null;
  copied: string | null;
  onToggleInspect: () => void;
  onCopy: (value: string) => void;
  displayLocator: (value: string) => string;
  history: PickerSnapshot[];
  onRestore: (snap: PickerSnapshot) => void;
  onClearHistory: () => void;
}

function channelLabel(index: number): string {
  return `CH-${String(index + 1).padStart(2, '0')}`;
}

export function InspectPanel({
  isInspecting,
  locators,
  meta,
  hoverPreview,
  copied,
  onToggleInspect,
  onCopy,
  displayLocator,
  history,
  onRestore,
  onClearHistory,
}: InspectPanelProps) {
  const [openSnap, setOpenSnap] = useState<number | null>(null);
  // id has its own pill — everything else runs inline beside the tag.
  const attrs = [
    meta?.className ? `.${meta.className.split(/\s+/).join('.')}` : '',
    (meta?.attributes ?? '').replace(/\s?(id|class)="[^"]*"/g, '').trim(),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        type="button"
        aria-pressed={isInspecting}
        aria-controls="locator-list"
        onClick={onToggleInspect}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--line)',
          background: 'var(--panel)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'center',
          textAlign: 'left',
          transition: 'border-color 150ms var(--ease-out-quint)',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, display: 'block', lineHeight: 1.2 }}>
            {isInspecting ? 'Inspecting — click element' : 'Start inspecting'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--muted)',
              display: 'block',
              marginTop: 2,
            }}
          >
            hover highlights · click locks · ESC exits
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 52,
            height: 29,
            borderRadius: 9999,
            background: isInspecting ? 'var(--sig)' : 'var(--panel-deep)',
            border: `1px solid ${isInspecting ? 'var(--sig-deep)' : 'var(--line)'}`,
            position: 'relative',
            flexShrink: 0,
            transition: 'background 200ms var(--ease-out-quint)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: 2,
              width: 23,
              height: 23,
              borderRadius: 9999,
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              transform: isInspecting ? 'translateX(23px)' : 'none',
              transition: 'transform 220ms var(--ease-out-quint)',
            }}
          />
        </span>
      </button>

      {isInspecting && (
        <div
          role="status"
          style={{
            background: 'var(--sig-soft)',
            border: '1px solid var(--sig)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--sig-deep)',
            }}
          >
            ● live scan
          </div>
          {hoverPreview ? (
            <div
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 12,
                marginTop: 4,
                wordBreak: 'break-all',
              }}
            >
              <span style={{ fontWeight: 600 }}>&lt;{hoverPreview.tag}&gt;</span>{' '}
              <span style={{ color: 'var(--muted)' }}>
                {hoverPreview.text?.slice(0, 36) || 'no text'}
                {hoverPreview.id && ` #${hoverPreview.id}`}
              </span>
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
              Move over the page to preview…
            </div>
          )}
        </div>
      )}

      {locators.length === 0 && !isInspecting && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: 14,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            No lock
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.55 }}>
            Flip the switch, hover the page, click to lock. You get paste-ready{' '}
            <code
              style={{
                fontFamily: 'var(--font-code)',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                padding: '0 4px',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              page.getBy*
            </code>{' '}
            lines — best first.
          </div>
        </div>
      )}

      {meta && (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              background: 'var(--bar)',
              color: 'var(--bar-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 9999,
              flexShrink: 0,
            }}
          >
            &lt;{meta.tag}&gt;
          </span>
          {meta.id && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                border: '1px solid var(--line)',
                padding: '2px 8px',
                borderRadius: 9999,
                flexShrink: 0,
              }}
            >
              #{meta.id}
            </span>
          )}
          {attrs && (
            <code
              title={attrs}
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 11,
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                flex: 1,
              }}
            >
              {attrs}
            </code>
          )}
        </div>
      )}

      {locators.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              Output · {locators.length} line{locators.length === 1 ? '' : 's'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
              CH-01 BEST
            </div>
          </div>
          <div
            id="locator-list"
            tabIndex={-1}
            role="list"
            aria-label="Ranked locators"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              outline: 'none',
            }}
          >
            {locators.map((loc, idx) => (
              <LocatorItem
                key={loc.value + String(idx)}
                locator={loc}
                isBest={idx === 0}
                channel={channelLabel(idx)}
                isCopied={copied === loc.value}
                onCopy={onCopy}
                displayValue={displayLocator(loc.value)}
              />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <HistoryAccordion title="Pick history" count={history.length} onClear={onClearHistory}>
          {history.map((snap, i) => {
            const open = openSnap === i;
            const best = snap.locators[0];
            return (
              <div
                key={snap.time + String(i)}
                style={{
                  borderBottom:
                    i < history.length - 1 ? '1px solid var(--line)' : '1px solid transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenSnap(open ? null : i);
                    if (!open) onRestore(snap);
                  }}
                  aria-expanded={open}
                  title="Restore this pick"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    color: 'var(--ink)',
                    font: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--muted)',
                      }}
                    >
                      {snap.meta ? `<${snap.meta.tag}>` : 'pick'} · {snap.time}
                    </span>
                    <code
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-code)',
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 2,
                      }}
                    >
                      {best ? displayLocator(best.value) : '—'}
                    </code>
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      color: 'var(--muted)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
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
                {open && (
                  <div style={{ borderTop: '1px solid var(--line)' }}>
                    {snap.locators.map((loc, idx) => (
                      <LocatorItem
                        key={loc.value + String(idx)}
                        locator={loc}
                        isBest={idx === 0}
                        channel={channelLabel(idx)}
                        isCopied={copied === loc.value}
                        onCopy={onCopy}
                        displayValue={displayLocator(loc.value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </HistoryAccordion>
      )}
    </>
  );
}
