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
        className="inspect-btn"
      >
        <span className="min-w-0">
          <span className="inspect-title">
            {isInspecting ? 'Inspecting — click element' : 'Start inspecting'}
          </span>
          <span className="inspect-sub">hover highlights · click locks · ESC exits</span>
        </span>
        <span aria-hidden="true" className={`switch switch--hero${isInspecting ? ' is-on' : ''}`}>
          <span className="switch-knob" />
        </span>
      </button>

      {isInspecting && (
        <div role="status" className="live-card">
          <div className="live-tag">● live scan</div>
          {hoverPreview ? (
            <div className="live-preview">
              <span className="fw-600">&lt;{hoverPreview.tag}&gt;</span>{' '}
              <span className="label--muted">
                {hoverPreview.text?.slice(0, 36) || 'no text'}
                {hoverPreview.id && ` #${hoverPreview.id}`}
              </span>
            </div>
          ) : (
            <div className="live-empty">Move over the page to preview…</div>
          )}
        </div>
      )}

      {locators.length === 0 && !isInspecting && (
        <div className="empty-card">
          <div className="label label--muted">No lock</div>
          <div className="empty-body">
            Flip the switch, hover the page, click to lock. You get paste-ready{' '}
            <code className="empty-code">page.getBy*</code> lines — best first.
          </div>
        </div>
      )}

      {meta && (
        <div className="meta-card">
          <span className="tag-pill">&lt;{meta.tag}&gt;</span>
          {meta.id && <span className="id-pill">#{meta.id}</span>}
          {attrs && (
            <code title={attrs} className="attr-code">
              {attrs}
            </code>
          )}
        </div>
      )}

      {locators.length > 0 && (
        <div className="output-stack">
          <div className="output-head">
            <div className="label label--muted">
              Output · {locators.length} line{locators.length === 1 ? '' : 's'}
            </div>
            <div className="label label--muted">CH-01 BEST</div>
          </div>
          <div
            id="locator-list"
            tabIndex={-1}
            role="list"
            aria-label="Ranked locators"
            className="loc-list"
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
              <div key={snap.time + String(i)} className="snap-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setOpenSnap(open ? null : i);
                    if (!open) onRestore(snap);
                  }}
                  aria-expanded={open}
                  title="Restore this pick"
                  className="row-btn"
                >
                  <span className="min-w-0 flex-1">
                    <span className="snap-meta">
                      {snap.meta ? `<${snap.meta.tag}>` : 'pick'} · {snap.time}
                    </span>
                    <code className="snap-code">{best ? displayLocator(best.value) : '—'}</code>
                  </span>
                  <span aria-hidden="true" className={`snap-chev${open ? ' is-open' : ''}`}>
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
                  <div className="snap-body">
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
