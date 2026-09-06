import { generateLocators } from '@/utils/locators';
import { parseManualLocator, collectManualSuggestions } from '@/utils/manualLocators';
import {
  ensurePickerOverlay,
  showPickerHighlight,
  hidePickerHighlight,
  flashPickerOverlay,
  clearManualHighlights,
  highlightManualElements,
} from '@/utils/overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  main(ctx) {
    const picker = createPicker(ctx);
    const manual = createManualHandler();

    ctx.onInvalidated(() => picker.teardown(true));
    // @ts-expect-error wxt locationchange may not be typed
    ctx.addEventListener?.('wxt:locationchange', () => picker.teardown(true));
    window.addEventListener('popstate', () => picker.teardown(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && picker.isActive()) hidePickerHighlight();
    });

    browser.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
      if (sender.id && sender.id !== browser.runtime.id) return false as unknown as boolean;
      const message = msg as { type?: string; locator?: string; selector?: string };
      if (message.type === 'picker:on') picker.activate();
      if (message.type === 'picker:off') picker.teardown();
      if (message.type === 'picker:toggle') {
        if (picker.isActive()) picker.teardown();
        else picker.activate();
      }
      if (message.type === 'picker:highlight' && typeof message.selector === 'string') {
        if (message.selector.length > 200) return false as unknown as boolean;
        try {
          const els = document.querySelectorAll(message.selector);
          if (els[0]) showPickerHighlight(els[0] as Element);
        } catch {
          void 0;
        }
      }
      if (message.type === 'picker:clear') hidePickerHighlight();
      if (message.type === 'manual:highlight' && typeof message.locator === 'string') {
        const { elements, error } = parseManualLocator(message.locator);
        if (error) {
          sendResponse({ count: 0, error });
          browser.runtime
            .sendMessage({
              type: 'manual:result',
              payload: { count: 0, error, locator: message.locator },
            })
            .catch(() => {
              void 0;
            });
        } else {
          highlightManualElements(elements);
          sendResponse({ count: elements.length, error: null });
          browser.runtime
            .sendMessage({
              type: 'manual:result',
              payload: { count: elements.length, error: null, locator: message.locator },
            })
            .catch(() => {
              void 0;
            });
        }
        return true;
      }
      if (message.type === 'manual:clear') {
        clearManualHighlights();
        sendResponse({ count: 0, error: null, cleared: true });
        browser.runtime
          .sendMessage({
            type: 'manual:result',
            payload: { count: 0, error: null, locator: '', cleared: true },
          })
          .catch(() => {
            void 0;
          });
        return true;
      }
      if (message.type === 'manual:suggestions') {
        const suggestions = collectManualSuggestions();
        sendResponse({ suggestions });
        return true;
      }
      return false as unknown as boolean;
    });

    console.log('[locator] content script ready', { url: location.href });
  },
});

function createPicker(ctx: { onInvalidated: (cb: () => void) => void }) {
  let active = false;
  let lastEl: Element | null = null;
  let rafId: number | null = null;
  let lastHoverAt = 0;

  const blockEvent = (event: Event) => {
    if (!active) return;
    if (event instanceof KeyboardEvent && event.key === 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    const stopImmediate = (event as unknown as { stopImmediatePropagation?: () => void })
      .stopImmediatePropagation;
    if (typeof stopImmediate === 'function') stopImmediate.call(event);
  };

  const BLOCKED_EVENTS: Array<[string, (event: Event) => void, boolean]> = [
    ['mousedown', blockEvent, true],
    ['mouseup', blockEvent, true],
    ['pointerdown', blockEvent, true],
    ['pointerup', blockEvent, true],
    ['auxclick', blockEvent, true],
    ['dblclick', blockEvent, true],
    ['contextmenu', blockEvent, true],
    ['dragstart', blockEvent, true],
    ['touchstart', blockEvent, true],
    ['touchend', blockEvent, true],
    ['submit', blockEvent, true],
  ];

  const getTarget = (event: MouseEvent): Element | null => {
    const path = (event as unknown as { composedPath?: () => EventTarget[] }).composedPath?.();
    if (path && path.length) {
      for (const target of path) {
        if (target instanceof Element && (target as Element).id !== '__locator-inspector-overlay')
          return target as Element;
      }
    }
    return event.target as Element | null;
  };

  const onMouseOver = (event: MouseEvent) => {
    if (!active) return;
    const target = getTarget(event);
    if (!target || target.id === '__locator-inspector-overlay') return;
    if ((target as Element).closest?.('#__locator-inspector-overlay')) return;
    if ((target as Element).closest?.('[aria-hidden="true"]')) return;
    lastEl = target as Element;
    const now = Date.now();
    if (now - lastHoverAt < 32) return;
    lastHoverAt = now;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      if (!active || !lastEl) return;
      showPickerHighlight(lastEl);
      const preview = {
        tag: lastEl.tagName.toLowerCase(),
        text:
          ((lastEl as HTMLElement).innerText ?? (lastEl as HTMLElement).textContent ?? '')
            .slice(0, 80)
            .trim() ||
          lastEl.getAttribute('aria-label') ||
          '',
        id: lastEl.getAttribute('id') || '',
        className: (lastEl as HTMLElement).className?.toString().slice(0, 80) || '',
      };
      browser.runtime.sendMessage({ type: 'picker:hover', payload: preview }).catch(() => {
        void 0;
      });
    });
  };

  const onClick = (event: MouseEvent) => {
    if (!active) return;
    const target = getTarget(event);
    if (!target || (target as Element).id === '__locator-inspector-overlay') return;
    const el = lastEl || (target as Element);
    if ((el as Element).closest?.('#__locator-inspector-overlay')) return;
    event.preventDefault();
    event.stopPropagation();
    (event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
    try {
      const locators = generateLocators(el as Element);
      const meta = {
        tag: (el as Element).tagName.toLowerCase(),
        text:
          (
            (el as Element as HTMLElement).innerText ??
            (el as Element as HTMLElement).textContent ??
            ''
          )
            .slice(0, 120)
            .trim() || '',
        id: (el as Element).getAttribute('id') || '',
        className: (el as Element as HTMLElement).className?.toString().slice(0, 80) || '',
        attributes: Array.from((el as Element).attributes)
          .slice(0, 10)
          .map((attr) => `${attr.name}="${attr.value.replace(/"/g, '&quot;').slice(0, 50)}"`)
          .join(' '),
      };
      browser.runtime
        .sendMessage({ type: 'locators', payload: { locators, meta, url: location.href } })
        .catch(() => {
          void 0;
        });
      teardown(false);
      flashPickerOverlay();
      browser.runtime
        .sendMessage({ type: 'picker:state', payload: { active: false, locked: true } })
        .catch(() => {
          void 0;
        });
    } catch (error) {
      console.warn('[locator] generate failed', error);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      event.stopPropagation();
      (event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      teardown();
    } else if (active && (event.key === 'Enter' || event.key === ' ')) {
      const target = document.activeElement as Element | null;
      if (target && lastEl && target === lastEl) {
        event.preventDefault();
        event.stopPropagation();
        (
          event as unknown as { stopImmediatePropagation?: () => void }
        ).stopImmediatePropagation?.();
      }
    }
  };

  const teardown = (removeOverlay = true) => {
    active = false;
    if (removeOverlay) hidePickerHighlight();
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('scroll', hidePickerHighlight as unknown as EventListener, true);
    for (const [evt, handler, cap] of BLOCKED_EVENTS) {
      document.removeEventListener(evt, handler, cap);
    }
    document.body.style.cursor = '';
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    browser.runtime.sendMessage({ type: 'picker:state', payload: { active: false } }).catch(() => {
      void 0;
    });
  };

  const activate = () => {
    if (active) return;
    active = true;
    lastEl = null;
    ensurePickerOverlay();
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('scroll', hidePickerHighlight as unknown as EventListener, true);
    for (const [evt, handler, cap] of BLOCKED_EVENTS) {
      document.addEventListener(evt, handler, cap);
    }
    document.body.style.cursor = 'crosshair';
    browser.runtime.sendMessage({ type: 'picker:state', payload: { active: true } }).catch(() => {
      void 0;
    });
  };

  return { isActive: () => active, activate, teardown };
}

function createManualHandler() {
  // Placeholder for future manual-specific logic
  return {};
}
