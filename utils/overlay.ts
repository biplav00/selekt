/**
 * Overlay management for picker and manual highlights
 * Extracted from content.ts to reduce complexity
 */

let pickerOverlay: HTMLDivElement | null = null;
let manualOverlays: HTMLDivElement[] = [];

export function ensurePickerOverlay(): HTMLDivElement {
  const existing = document.querySelectorAll('#__locator-inspector-overlay');
  if (existing.length > 1) {
    for (let i = 1; i < existing.length; i++) existing[i].remove();
  }
  if (pickerOverlay && pickerOverlay.isConnected) return pickerOverlay;
  const found = document.getElementById('__locator-inspector-overlay') as HTMLDivElement | null;
  if (found) {
    pickerOverlay = found;
    return pickerOverlay;
  }
  pickerOverlay = document.createElement('div');
  pickerOverlay.id = '__locator-inspector-overlay';
  pickerOverlay.setAttribute('aria-hidden', 'true');
  pickerOverlay.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483647;border:1.5px solid #facc15;background:rgba(250,204,21,0.08);box-shadow:0 0 0 1px #18181b;';
  pickerOverlay.style.display = 'none';
  (document.body || document.documentElement).appendChild(pickerOverlay);
  return pickerOverlay;
}

export function showPickerHighlight(el: Element): void {
  if (!el || !(el instanceof Element)) return;
  try {
    const checkVisibility = (el as unknown as { checkVisibility?: () => boolean }).checkVisibility;
    if (typeof checkVisibility === 'function' && !checkVisibility.call(el)) {
      hidePickerHighlight();
      return;
    }
  } catch {
    // ignore
    void 0;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    hidePickerHighlight();
    return;
  }
  const overlay = ensurePickerOverlay();
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = 'block';
}

export function hidePickerHighlight(): void {
  if (pickerOverlay) pickerOverlay.style.display = 'none';
}

export function flashPickerOverlay(): void {
  const overlay = ensurePickerOverlay();
  overlay.style.border = '1.5px solid #facc15';
  overlay.style.background = 'rgba(250,204,21,0.12)';
  overlay.style.boxShadow = '0 0 0 1px #18181b';
  setTimeout(() => {
    if (overlay) {
      overlay.style.border = '1.5px solid #facc15';
      overlay.style.background = 'rgba(250,204,21,0.08)';
      overlay.style.boxShadow = '0 0 0 1px #18181b';
    }
  }, 600);
}

export function clearManualHighlights(): void {
  manualOverlays.forEach((overlay) => overlay.remove());
  manualOverlays = [];
}

export function highlightManualElements(elements: Element[]): void {
  clearManualHighlights();
  elements.forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const overlay = document.createElement('div');
    overlay.className = '__locator-manual-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;border:1.5px solid #facc15;background:rgba(250,204,21,0.12);box-shadow:0 0 0 1px #18181b;`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    if (elements.length > 1) {
      const badge = document.createElement('div');
      badge.textContent = String(idx + 1);
      badge.style.cssText = `position:absolute;top:-8px;left:-8px;background:#18181b;color:#fafafa;font-family:ui-monospace,monospace;font-size:10px;font-weight:700;padding:1px 4px;line-height:1;`;
      overlay.appendChild(badge);
    }
    (document.body || document.documentElement).appendChild(overlay);
    manualOverlays.push(overlay);
  });
  if (elements.length > 0) {
    const onScroll = () => clearManualHighlights();
    document.addEventListener('scroll', onScroll, { once: true, capture: true });
    setTimeout(() => document.removeEventListener('scroll', onScroll, true), 3000);
  }
}
