/** Formatting helpers shared by services (mirrors the Spring Fmt and BootstrapAdmin.initials logic). */

/** Invoice number from the workspace prefix, e.g. "INV-{YYYY}-" + 122 becomes "INV-2026-0122". */
export function invoiceNumber(prefix: string, year: number, number: number): string {
  return prefix.replace('{YYYY}', String(year)) + String(number).padStart(4, '0');
}

/** File size as the UI shows it: KB under 1 MB, otherwise MB with one decimal. */
export function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Up to two initials from a full name. */
export function initials(name: string): string {
  let out = '';
  for (const part of name.trim().split(/\s+/)) {
    if (part && out.length < 2) out += part[0].toUpperCase();
  }
  return out || '?';
}

/** Amount with thousands separators and two decimals, e.g. 1234.5 becomes "1,234.50". */
export function amount2(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Round to two decimals, like BigDecimal.setScale(2, HALF_UP). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];

/** "5 Jan 2026" from an ISO date. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}
