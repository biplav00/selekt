/**
 * Shared tab targeting for probe messages (manual highlight/clear,
 * suggestions, picker relay).
 *
 * tabs.query({}) spans every open window and tab.active is true
 * per-window, so a global find can land in the wrong window entirely.
 * Always prefer the current window's active tab.
 */
export async function findProbeTab() {
  try {
    const [current] = await browser.tabs.query({ active: true, currentWindow: true });
    if (current?.url?.startsWith('http') && current.id != null) return current;
    const tabs = await browser.tabs.query({});
    const httpTabs = tabs.filter((tab) => tab.url && tab.url.startsWith('http'));
    return tabs.find((tab) => tab.active && tab.url && tab.url.startsWith('http')) ?? httpTabs[0];
  } catch {
    return undefined;
  }
}
