import type { Locator, Meta, PickerState, ManualResult } from '../types';

export type ExtensionMessage =
  | { type: 'locators'; payload: { locators: Locator[]; meta: Meta | null; url: string } }
  | { type: 'picker:hover'; payload: Meta }
  | { type: 'picker:state'; payload: PickerState }
  | { type: 'picker:on' }
  | { type: 'picker:off' }
  | { type: 'picker:toggle' }
  | { type: 'picker:highlight'; selector: string }
  | { type: 'picker:clear' }
  | { type: 'manual:highlight'; locator: string }
  | { type: 'manual:clear' }
  | { type: 'manual:result'; payload: ManualResult & { locator?: string; cleared?: boolean } }
  | { type: 'manual:suggestions' };

export type TabInfo = { id?: number; url?: string; active?: boolean };
