export interface Locator {
  kind: string;
  value: string;
  score: number;
}

export interface Meta {
  tag: string;
  text: string;
  id: string;
  className: string;
  attributes?: string;
}

export type PickerState = { active: boolean; locked?: boolean };

export interface ManualResult {
  count: number;
  error: string | null;
}

export interface Settings {
  theme: 'light' | 'dark';
  omitPage: boolean;
}

export type TabId = 'inspect' | 'manual';

export type RuntimeMessage =
  | { type: 'locators'; payload: { locators: Locator[]; meta: Meta | null; url: string } }
  | { type: 'picker:hover'; payload: Meta }
  | { type: 'picker:state'; payload: PickerState }
  | { type: 'manual:result'; payload: { count: number; error: string | null; cleared?: boolean } };
