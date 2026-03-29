import { css } from 'lit';

export const sharedStyles = css`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  button {
    cursor: pointer;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
  }

  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-css { background: color-mix(in srgb, var(--badge-css) 15%, transparent); color: var(--badge-css); }
  .badge-xpath { background: color-mix(in srgb, var(--badge-xpath) 15%, transparent); color: var(--badge-xpath); }
  .badge-pw { background: color-mix(in srgb, var(--badge-pw) 15%, transparent); color: var(--badge-pw); }
  .badge-cy { background: color-mix(in srgb, var(--badge-cy) 15%, transparent); color: var(--badge-cy); }
  .badge-se { background: color-mix(in srgb, var(--badge-se) 15%, transparent); color: var(--badge-se); }

  .score-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 700;
  }

  .score-good { background: color-mix(in srgb, var(--score-good) 12%, transparent); color: var(--score-good); }
  .score-medium { background: color-mix(in srgb, var(--score-medium) 12%, transparent); color: var(--score-medium); }
  .score-poor { background: color-mix(in srgb, var(--score-poor) 12%, transparent); color: var(--score-poor); }

  .mono {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 11px;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .btn-secondary:hover {
    background: var(--border);
  }

  .warning-text {
    color: var(--warning);
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input[type="text"],
  textarea,
  select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    padding: 6px 10px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type="text"]:focus,
  textarea:focus,
  select:focus {
    border-color: var(--accent);
  }
`;
