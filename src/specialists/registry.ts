import type { SelectorFormat } from '@/types';
import { specialist as css } from './css';
import { specialist as cypress } from './cypress';
import { specialist as playwright } from './playwright';
import { specialist as selenium } from './selenium';
import type { SelectorSpecialist } from './types';
import { specialist as xpath } from './xpath';

const specialists = new Map<SelectorFormat, SelectorSpecialist>();
for (const s of [css, xpath, playwright, cypress, selenium]) {
  specialists.set(s.format, s);
}

export function getSpecialist(format: SelectorFormat): SelectorSpecialist {
  const s = specialists.get(format);
  if (!s) throw new Error(`Unknown specialist format: ${format}`);
  return s;
}

export function getAllSpecialists(): SelectorSpecialist[] {
  return Array.from(specialists.values());
}

export function getFormats(): SelectorFormat[] {
  return Array.from(specialists.keys());
}
