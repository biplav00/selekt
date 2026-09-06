import { useEffect } from 'react';
import type { Locator, Meta, PickerState, ManualResult } from '../types';

interface UseMessagesOptions {
  onLocators: (locators: Locator[], meta: Meta | null, url: string) => void;
  onHover: (meta: Meta) => void;
  onPickerState: (active: boolean) => void;
  onManualResult: (result: ManualResult | null) => void;
}

export function useMessages(options: UseMessagesOptions): void {
  const { onLocators, onHover, onPickerState, onManualResult } = options;

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string; payload?: unknown };
      if (msg.type === 'locators' && isLocatorsPayload(msg.payload)) {
        onLocators(msg.payload.locators, msg.payload.meta, msg.payload.url);
      }
      if (msg.type === 'picker:hover' && isMetaPayload(msg.payload)) {
        onHover(msg.payload);
      }
      if (msg.type === 'picker:state' && isPickerStatePayload(msg.payload)) {
        onPickerState(!!(msg.payload as PickerState).active);
      }
      if (msg.type === 'manual:result' && isManualResultPayload(msg.payload)) {
        const payload = msg.payload as { count: number; error: string | null; cleared?: boolean };
        if (payload.cleared) onManualResult(null);
        else onManualResult({ count: payload.count, error: payload.error });
      }
    };

    browser.runtime.onMessage.addListener(handleMessage as (message: unknown) => void);
    return () =>
      browser.runtime.onMessage.removeListener(handleMessage as (message: unknown) => void);
  }, [onLocators, onHover, onPickerState, onManualResult]);
}

function isLocatorsPayload(payload: unknown): payload is {
  locators: import('../types').Locator[];
  meta: import('../types').Meta | null;
  url: string;
} {
  return typeof payload === 'object' && payload !== null && 'locators' in payload;
}

function isMetaPayload(payload: unknown): payload is import('../types').Meta {
  return typeof payload === 'object' && payload !== null && 'tag' in payload;
}

function isPickerStatePayload(payload: unknown): payload is import('../types').PickerState {
  return typeof payload === 'object' && payload !== null && 'active' in payload;
}

function isManualResultPayload(
  payload: unknown
): payload is { count: number; error: string | null; cleared?: boolean } {
  return typeof payload === 'object' && payload !== null && 'count' in payload;
}
