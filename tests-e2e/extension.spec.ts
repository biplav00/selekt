import { expect, test } from '@playwright/test';

test.describe('Selekt Extension UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});

test.describe('Selector Card Component', () => {
  test('renders selector card with correct data', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const selectorCard = page.locator('selector-card').first();
    await expect(selectorCard).toBeVisible();
  });

  test('shows tooltip on truncated selector', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const selectorText = page.locator('.selector-text').first();
    const title = await selectorText.getAttribute('title');
    expect(title).toBeTruthy();
  });

  test('copy action is triggered on click', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const selectorRow = page.locator('.row').first();
    await selectorRow.click();

    // Toast should appear
    const toast = page.locator('selekt-toast');
    await expect(toast).toBeVisible();
  });
});

test.describe('Tab Navigation', () => {
  test('tabs are keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const pickTab = page.locator('#tab-pick');
    const buildTab = page.locator('#tab-build');

    await pickTab.focus();
    await page.keyboard.press('ArrowRight');

    // Build tab should now be focused
    await expect(buildTab).toBeFocused();
  });

  test('clicking tab switches content', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const buildTab = page.locator('#tab-build');
    await buildTab.click();

    // Panel should now show build content
    const buildPanel = page.locator('#panel-build');
    await expect(buildPanel).toBeVisible();
  });
});

test.describe('Theme Switching', () => {
  test('cycles through themes on button click', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const themeBtn = page.locator('button[aria-label="Cycle theme"]');
    await themeBtn.click();

    // Toast should confirm theme change
    const toast = page.locator('selekt-toast');
    await expect(toast).toContainText('Theme');
  });
});
