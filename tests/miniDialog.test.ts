import { describe, it, expect, beforeEach } from 'vitest';
import {
  clampDialogPosition,
  showMiniDialog,
  hideMiniDialog,
  isMiniOpen,
  refreshBest,
  MINI_ROOT_ID,
} from '../utils/miniDialog';

describe('clampDialogPosition', () => {
  it('keeps the dialog inside the viewport', () => {
    expect(clampDialogPosition(-50, -20, 300, 150, 1280, 800)).toEqual({ x: 8, y: 8 });
    expect(clampDialogPosition(1200, 750, 300, 150, 1280, 800)).toEqual({ x: 972, y: 642 });
    expect(clampDialogPosition(100, 100, 300, 150, 1280, 800)).toEqual({ x: 100, y: 100 });
  });

  it('floors at the margin on tiny viewports', () => {
    expect(clampDialogPosition(0, 0, 300, 150, 200, 200)).toEqual({ x: 8, y: 8 });
  });
});

describe('mini dialog host', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    hideMiniDialog();
  });

  const callbacks = { onPick: () => {}, onExpand: () => {} };

  it('shows and hides the shadow host', () => {
    expect(isMiniOpen()).toBe(false);
    showMiniDialog({ raw: "page.getByTestId('x')", kind: 'testId' }, callbacks);
    expect(isMiniOpen()).toBe(true);
    const host = document.getElementById(MINI_ROOT_ID);
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull();
    hideMiniDialog();
    expect(isMiniOpen()).toBe(false);
    expect(document.getElementById(MINI_ROOT_ID)).toBeNull();
  });

  it('renders the best locator and updates it', async () => {
    showMiniDialog({ raw: "page.getByTestId('x')", kind: 'testId' }, callbacks);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const host = document.getElementById(MINI_ROOT_ID);
    const code = host?.shadowRoot?.querySelector('#selekt-mini-code');
    expect(code?.textContent).toContain("getByTestId('x')");
    await refreshBest({ raw: "page.getByRole('button', { name: 'Go' })", kind: 'role' });
    expect(code?.textContent).toContain('getByRole');
  });

  it('shows the empty state with no locator', () => {
    showMiniDialog({ raw: '', kind: '' }, callbacks);
    const host = document.getElementById(MINI_ROOT_ID);
    expect(host?.shadowRoot?.querySelector('#selekt-mini-code')?.textContent).toContain('pick an');
  });

  it('toggles tabs without scanning; re-clicking ⌖ re-arms the pick', async () => {
    let picks = 0;
    showMiniDialog(
      { raw: "page.getByTestId('x')", kind: 'testId' },
      {
        onPick: () => {
          picks++;
        },
        onExpand: () => {},
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const root = document.getElementById(MINI_ROOT_ID)?.shadowRoot;
    const tabs = root?.querySelectorAll('.segbtn');
    const panes = root?.querySelectorAll('.pane');
    const inspectTab = tabs?.[0] as HTMLElement;
    const manualTab = tabs?.[1] as HTMLElement;
    const inspectPane = panes?.[0] as HTMLElement;
    // toggling to manual must not scan
    manualTab.click();
    expect(picks).toBe(0);
    expect(inspectPane.style.display).toBe('none');
    // switching back must not scan either
    inspectTab.click();
    expect(picks).toBe(0);
    expect(inspectPane.style.display).not.toBe('none');
    // re-clicking the active ⌖ re-arms
    inspectTab.click();
    expect(picks).toBe(1);
  });

  it('reset clears the locked locator', async () => {
    showMiniDialog({ raw: "page.getByTestId('x')", kind: 'testId' }, callbacks);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const root = document.getElementById(MINI_ROOT_ID)?.shadowRoot;
    (root?.querySelector('[aria-label="Reset"]') as HTMLElement).click();
    expect(root?.querySelector('#selekt-mini-code')?.textContent).toContain('pick an');
  });
});
