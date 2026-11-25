/**
 * Business dates are ISO strings (YYYY-MM-DD) interpreted in the workspace timezone,
 * matching the Java LocalDate.now(clock) behaviour of the Spring backend.
 */

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Today's date in the given IANA timezone, as YYYY-MM-DD. */
export function todayIn(zone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Timestamp as "yyyy-MM-dd HH:mm" in the workspace timezone (the format the UI expects). */
export function stampIn(date: Date | null | undefined, zone: string): string | null {
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses YYYY-MM-DD into [y, m, d] when it is a real calendar date, otherwise null. */
export function parseIso(value: string): [number, number, number] | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return [y, mo, d];
}

const fmtIso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Adds days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = parseIso(iso) ?? [1970, 1, 1];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return fmtIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Adds months to an ISO date, clamping the day to the end of the target month (like java.time). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parseIso(iso) ?? [1970, 1, 1];
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return fmtIso(ty, tm, Math.min(d, lastDay));
}

/** Monday of the week containing the given ISO date. */
export function mondayOf(iso: string): string {
  const [y, m, d] = parseIso(iso) ?? [1970, 1, 1];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** ISO weekday: Monday = 1 ... Sunday = 7. */
export function isoDayOfWeek(iso: string): number {
  const [y, m, d] = parseIso(iso) ?? [1970, 1, 1];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

