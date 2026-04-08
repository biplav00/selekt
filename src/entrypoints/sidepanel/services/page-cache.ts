import type { RichPageData } from '@/specialists/types';
import { emptyPageData } from '@/specialists/helpers/page-data';
import { scrapePageData } from './messaging';

let cache: RichPageData = emptyPageData();
let lastScrapeTime = 0;
let scrapeTimer: ReturnType<typeof setTimeout> | null = null;
const MIN_SCRAPE_INTERVAL = 2000;

/** Get the current cached page data. */
export function getPageData(): RichPageData {
  return cache;
}

/** Request a fresh scrape from the content script. Debounced to 2s. */
export function requestScrape(): void {
  const now = Date.now();
  if (now - lastScrapeTime < MIN_SCRAPE_INTERVAL) {
    if (!scrapeTimer) {
      scrapeTimer = setTimeout(() => {
        scrapeTimer = null;
        doScrape();
      }, MIN_SCRAPE_INTERVAL - (now - lastScrapeTime));
    }
    return;
  }
  doScrape();
}

async function doScrape(): Promise<void> {
  try {
    cache = await scrapePageData();
    lastScrapeTime = Date.now();
  } catch {
    // Content script not available — keep existing cache
  }
}

/** Reset cache (e.g., on tab change). */
export function resetCache(): void {
  cache = emptyPageData();
  lastScrapeTime = 0;
}
