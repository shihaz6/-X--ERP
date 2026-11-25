import { badRequest } from './errors';
import { parseIso } from './time';

/** Input checks. Messages match the Spring backend so the UI shows the same text. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9._-]{3,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function required(value: unknown, field: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) throw badRequest(`${field} is required`);
  return v;
}

/** Trimmed value, or null when blank. */
export function optional(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v : null;
}

export function email(value: unknown): string {
  const v = required(value, 'Email').toLowerCase();
  if (!EMAIL.test(v)) throw badRequest('Enter a valid email address');
  return v;
}

export function username(value: unknown): string {
  const v = required(value, 'Username').toLowerCase();
  if (!USERNAME.test(v)) {
    throw badRequest('Username must be 3-40 characters: letters, digits, dot, underscore or dash');
  }
  return v;
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const v = required(value, field);
  if (!(allowed as readonly string[]).includes(v)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function positive(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) throw badRequest(`${field} must be greater than 0`);
  return cents(n);
}

export function nonNegative(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n < 0) throw badRequest(`${field} cannot be negative`);
  return cents(n);
}

export function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${field} is required`);
  return parseDate(value, field);
}

/** Returns null when the value is blank. */
export function optionalDate(value: unknown, field: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return parseDate(value, field);
}

export function notBefore(end: string, start: string, message: string): void {
  if (end < start) throw badRequest(message);
}

export function uuid(value: unknown, field: string): string {
  const v = required(value, field);
  if (!UUID.test(v)) throw badRequest(`${field} is not a valid identifier`);
  return v.toLowerCase();
}

/** Returns null when blank, otherwise the validated id. */
export function optionalUuid(value: unknown, field: string): string | null {
  return optional(value) === null ? null : uuid(value, field);
}

function parseDate(value: string, field: string): string {
  const parts = parseIso(value.trim());
  if (!parts) throw badRequest(`${field} must be a date in the format YYYY-MM-DD`);
  return value.trim();
}
