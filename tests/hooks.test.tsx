import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePicker } from '../entrypoints/sidepanel/hooks/usePicker';
import { useManual } from '../entrypoints/sidepanel/hooks/useManual';

function stubBrowser(options?: {
  queryTabs?: unknown[];
  sendResponse?: unknown;
  stored?: Record<string, unknown>;
}) {
  const setCalls: Array<Record<string, unknown>> = [];
  const sent: Array<{ id: number; message: unknown }> = [];
  const tabs = options?.queryTabs ?? [{ id: 7, url: 'https://shop.demo/cart', active: true }];
  const browserStub = {
    storage: {
      local: {
        get: vi.fn(async () => options?.stored ?? {}),
        set: vi.fn(async (value: Record<string, unknown>) => {
          setCalls.push(value);
        }),
      },
    },
    tabs: {
      query: vi.fn(async () => tabs),
      sendMessage: vi.fn(async (id: number, message: unknown) => {
        sent.push({ id, message });
        return options?.sendResponse ?? null;
      }),
    },
  };
  vi.stubGlobal('browser', browserStub);
  return { browserStub, setCalls, sent };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('usePicker history', () => {
  it('records locks, dedupes consecutive repeats, restores snapshots', async () => {
    stubBrowser();
    const { result } = renderHook(() => usePicker());
    const locs = [{ kind: 'testId', value: "page.getByTestId('x')", score: 1 }];
    const meta = { tag: 'button', text: 'X', id: '', className: '' };

    act(() => {
      result.current.handleLocators(locs, meta, 'https://shop.demo/cart');
    });
    expect(result.current.history).toHaveLength(1);

    // Re-locking the same element must not stack a duplicate.
    act(() => {
      result.current.handleLocators(locs, meta, 'https://shop.demo/cart');
    });
    expect(result.current.history).toHaveLength(1);

    const other = [{ kind: 'role', value: "page.getByRole('button')", score: 1 }];
    act(() => {
      result.current.handleLocators(other, meta, 'https://shop.demo/other');
    });
    expect(result.current.history).toHaveLength(2);

    // Restore puts the snapshot back into the panel.
    act(() => {
      result.current.clearPicker();
    });
    expect(result.current.locators).toHaveLength(0);
    act(() => {
      result.current.restoreSnapshot(result.current.history[1]);
    });
    expect(result.current.locators).toEqual(locs);
    expect(result.current.url).toBe('https://shop.demo/cart');
  });

  it('persists history to storage and reloads it', async () => {
    const stored = {
      pickerHistory: [
        {
          time: '12:00',
          url: 'https://shop.demo/a',
          meta: null,
          locators: [{ kind: 'css', value: "page.locator('#a')", score: 1 }],
        },
      ],
    };
    const { setCalls } = stubBrowser({ stored });
    const { result } = renderHook(() => usePicker());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].locators[0].value).toBe("page.locator('#a')");
    expect(setCalls.length).toBeGreaterThan(0);
  });
});

describe('useManual record + normalize', () => {
  it('targets the current window tab and records explicit probes', async () => {
    const { sent } = stubBrowser({ sendResponse: { count: 2, error: null } });
    const { result } = renderHook(() => useManual('manual', ''));
    // Let mount effects (suggestions fetch, empty-query clear) settle first.
    await act(async () => {});
    sent.length = 0;

    act(() => {
      result.current.setManualLocator("page.getByTestId('go')");
    });
    await act(async () => {
      await result.current.handleManualHighlight(true);
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].id).toBe(7);
    expect(result.current.manualResult).toEqual({ count: 2, error: null });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].query).toBe("page.getByTestId('go')");
  });

  it('restores the page. prefix for bare getBy forms before sending', async () => {
    const { sent } = stubBrowser({ sendResponse: { count: 1, error: null } });
    const { result } = renderHook(() => useManual('manual', ''));
    await act(async () => {});
    sent.length = 0;

    act(() => {
      result.current.setManualLocator("getByTestId('go')");
    });
    await act(async () => {
      await result.current.handleManualHighlight(true);
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].message).toMatchObject({
      type: 'manual:highlight',
      locator: "page.getByTestId('go')",
    });
    // History keeps what the user typed.
    expect(result.current.history[0].query).toBe("getByTestId('go')");
  });

  it('does not record live-search (debounced) probes', async () => {
    stubBrowser({ sendResponse: { count: 1, error: null } });
    const { result } = renderHook(() => useManual('manual', ''));
    act(() => {
      result.current.setManualLocator("page.getByTestId('go')");
    });
    await act(async () => {
      await result.current.handleManualHighlight(false);
    });
    expect(result.current.manualResult).toEqual({ count: 1, error: null });
    expect(result.current.history).toHaveLength(0);
  });
});
