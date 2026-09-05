import type { Locator, Meta } from '../types';
import { LocatorItem } from './LocatorItem';

interface InspectPanelProps {
  isInspecting: boolean;
  locators: Locator[];
  meta: Meta | null;
  hoverPreview: Meta | null;
  url: string;
  copied: string | null;
  onToggleInspect: () => void;
  onCopy: (value: string) => void;
  displayLocator: (value: string) => string;
}

export function InspectPanel({ isInspecting, locators, meta, hoverPreview, url, copied, onToggleInspect, onCopy, displayLocator }: InspectPanelProps) {
  return (
    <>
      <button
        type="button"
        aria-pressed={isInspecting}
        aria-controls="locator-list"
        onClick={onToggleInspect}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 10,
          border: `1px solid ${isInspecting ? 'var(--accent)' : 'var(--ink)'}`,
          background: isInspecting ? 'var(--accent)' : 'var(--ink)',
          color: '#fff',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)',
          transition: 'all 150ms var(--ease-out-quint)',
        }}
      >
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 9999, background: '#fff', display: 'inline-block', animation: isInspecting ? 'pulse-dot 1.2s var(--ease-out-quint) infinite' : 'none' }} />
          {isInspecting ? 'Inspecting — Click element' : 'Start Inspect'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8, border: '1px solid rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.12)' }}>
          {isInspecting ? 'ESC' : '⌥⇧C'}
        </span>
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>
        <span>{isInspecting ? 'Hover highlights • click locks' : 'Opens picker in active tab'}</span>
        <span>{isInspecting ? 'crosshair' : 'persistent'}</span>
      </div>

      {isInspecting && locators.length === 0 && (
        <div style={{ background: 'var(--accent-soft)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 12 }}>◎</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>Hover → Click to lock</div>
            {hoverPreview ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 2, wordBreak: 'break-all' }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>&lt;{hoverPreview.tag}&gt;</span> {hoverPreview.text?.slice(0, 36) || <span style={{ color: '#a1a1aa' }}>no text</span>}
                {hoverPreview.id && <span style={{ color: 'var(--muted)' }}> #{hoverPreview.id}</span>}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>Move over page to preview.</div>
            )}
          </div>
        </div>
      )}

      {locators.length === 0 && !isInspecting && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 14 }}>◎</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, marginTop: 10 }}>No selection</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
            Start inspect to generate <span style={{ fontFamily: 'var(--font-mono)', background: '#f4f4f5', padding: '1px 4px', borderRadius: 4, fontSize: 11 }}>page.getBy*</span> locators — paste-ready.
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg)', border: '1px solid var(--line)', padding: '4px 8px', borderRadius: 9999 }}>data-testid →</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg)', border: '1px solid var(--line)', padding: '4px 8px', borderRadius: 9999 }}>getByRole →</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg)', border: '1px solid var(--line)', padding: '4px 8px', borderRadius: 9999 }}>getByLabel</span>
          </div>
        </div>
      )}

      {meta && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span style={{ background: 'var(--ink)', color: '#fff', padding: '3px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>&lt;{meta.tag}&gt;</span>
          {meta.id && <span style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: 9999, fontSize: 11 }}>#{meta.id}</span>}
          {meta.text && <span style={{ color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{meta.text.slice(0, 32)}&rdquo;</span>}
          {url && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new URL(url).hostname}</span>}
        </div>
      )}

      {locators.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Locators · {locators.length}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>first is best</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {locators.map((loc, idx) => (
              <LocatorItem key={loc.value + String(idx)} locator={loc} isBest={idx === 0} isCopied={copied === loc.value} onCopy={onCopy} displayValue={displayLocator(loc.value)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
