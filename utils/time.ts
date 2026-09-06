/** Wall-clock stamp for history rows (HH:MM). */
export function timeStamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
