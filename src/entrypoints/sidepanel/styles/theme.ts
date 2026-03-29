import { css } from 'lit';

export const themeStyles = css`
  :host {
    /* Dark theme (default) */
    --bg-primary: #09090b;
    --bg-secondary: #111114;
    --bg-tertiary: #18181b;
    --border: #27272a;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-tertiary: #8b8b93;
    --accent: #3b82f6;
    --accent-hover: #2563eb;
    --success: #22c55e;
    --warning: #eab308;
    --error: #ef4444;

    /* Format badge colors */
    --badge-css: #3b82f6;
    --badge-xpath: #f97316;
    --badge-pw: #8b5cf6;
    --badge-cy: #22c55e;
    --badge-se: #06b6d4;

    /* Score colors */
    --score-good: #22c55e;
    --score-medium: #eab308;
    --score-poor: #ef4444;

    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: var(--text-primary);
    background: var(--bg-primary);
  }

  :host([theme='light']) {
    --bg-primary: #ffffff;
    --bg-secondary: #f4f4f5;
    --bg-tertiary: #e4e4e7;
    --border: #e4e4e7;
    --text-primary: #09090b;
    --text-secondary: #3f3f46;
    --text-tertiary: #71717a;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --success: #16a34a;
    --warning: #ca8a04;
    --error: #dc2626;

    --badge-css: #2563eb;
    --badge-xpath: #ea580c;
    --badge-pw: #7c3aed;
    --badge-cy: #16a34a;
    --badge-se: #0891b2;

    --score-good: #16a34a;
    --score-medium: #ca8a04;
    --score-poor: #dc2626;
  }
`;
