import { addDays, addMonths, mondayOf, isoDayOfWeek, stampIn, todayIn, parseIso } from '../../src/common/time';
import * as V from '../../src/common/validation';
import { parseRole, Permissions, ROLES } from '../../src/common/permissions';
import { invoiceNumber, humanSize, longDate, initials, round2 } from '../../src/common/format';
import { parseDurationMs, loadConfig } from '../../src/config';
import { effectiveStatus } from '../../src/invoices/invoices.service';
import { sha256 } from '../../src/auth/auth.service';
import { describeError } from '../../src/common/error.filter';
import { badRequest } from '../../src/common/errors';

describe('dates', () => {
  it('adds months and clamps the day to the end of the month', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the Monday of the week, including Sundays', () => {
    expect(mondayOf('2026-11-25')).toBe('2026-11-23'); // Wednesday
    expect(mondayOf('2026-11-29')).toBe('2026-11-23'); // Sunday
    expect(mondayOf('2026-11-23')).toBe('2026-11-23'); // Monday
  });

  it('gives ISO weekdays with Monday as 1 and Sunday as 7', () => {
    expect(isoDayOfWeek('2026-11-23')).toBe(1);
    expect(isoDayOfWeek('2026-11-29')).toBe(7);
  });

  it('reads today and timestamps in the workspace timezone', () => {
    // 2026-11-24 23:30 UTC is already 2026-11-25 in Colombo (UTC+5:30).
    const instant = new Date('2026-11-24T23:30:00Z');
    expect(todayIn('Asia/Colombo', instant)).toBe('2026-11-25');
    expect(stampIn(instant, 'Asia/Colombo')).toBe('2026-11-25 05:00');
  });

  it('rejects impossible calendar dates', () => {
    expect(parseIso('2026-02-30')).toBeNull();
    expect(parseIso('2026-1-5')).toBeNull();
    expect(parseIso('2026-02-28')).toEqual([2026, 2, 28]);
  });
});

describe('validation', () => {
  it('accepts and lower-cases emails, and rejects malformed ones with the UI message', () => {
    expect(V.email(' Jane@Acme.test ')).toBe('jane@acme.test');
    expect(() => V.email('not-an-email')).toThrow('Enter a valid email address');
    expect(() => V.email('')).toThrow('Email is required');
  });

  it('checks usernames against the database rule', () => {
    expect(V.username('Test.Admin')).toBe('test.admin');
    expect(() => V.username('ab')).toThrow(/Username must be 3-40 characters/);
    expect(() => V.username('has space')).toThrow(/Username must be 3-40 characters/);
  });

  it('lists the allowed values when a choice is wrong', () => {
    expect(() => V.oneOf('Bogus', 'Status', ['Draft', 'Sent'] as const)).toThrow('Status must be one of: Draft, Sent');
  });

  it('requires positive amounts and rounds to two decimals', () => {
    expect(V.positive(10.005, 'Amount')).toBe(10.01);
    expect(() => V.positive(0, 'Amount')).toThrow('Amount must be greater than 0');
    expect(() => V.nonNegative(-1, 'Deal value')).toThrow('Deal value cannot be negative');
  });

  it('enforces the date format and end-after-start rules', () => {
    expect(() => V.date('2026-13-01', 'Start date')).toThrow('Start date must be a date in the format YYYY-MM-DD');
    expect(() => V.notBefore('2026-01-01', '2026-02-01', 'End date must be on or after the start date'))
      .toThrow('End date must be on or after the start date');
  });

  it('validates identifiers', () => {
    expect(V.uuid('C14A2487-02C1-4E13-9AC1-4D0C671405CB', 'Client')).toBe('c14a2487-02c1-4e13-9ac1-4d0c671405cb');
    expect(() => V.uuid('nope', 'Client')).toThrow('Client is not a valid identifier');
    expect(V.optionalUuid('  ', 'Project')).toBeNull();
  });
});

describe('roles and permissions', () => {
  it('parses both the label and the stored name, in any case', () => {
    expect(parseRole('Project Manager')).toBe('PROJECT_MANAGER');
    expect(parseRole('finance_manager')).toBe('FINANCE_MANAGER');
    expect(() => parseRole('Janitor')).toThrow('Unknown role: Janitor');
  });

  it('keeps the Spring access matrix', () => {
    expect(Permissions.finance('FINANCE_MANAGER')).toBe(true);
    expect(Permissions.finance('PROJECT_MANAGER')).toBe(false);
    expect(Permissions.crm('FINANCE_MANAGER')).toBe(true);
    expect(Permissions.editCrm('FINANCE_MANAGER')).toBe(false);
    expect(Permissions.orders('DEVELOPER')).toBe(false);
    expect(Permissions.team('FINANCE_MANAGER')).toBe(false);
    expect(Permissions.seesAllProjects('DEVELOPER')).toBe(false);
    expect(Permissions.admin('SUPER_ADMIN')).toBe(true);
    expect(ROLES).toHaveLength(4);
  });
});

describe('formatting', () => {
  it('builds invoice numbers from the prefix and a padded counter', () => {
    expect(invoiceNumber('INV-{YYYY}-', 2026, 7)).toBe('INV-2026-0007');
    expect(invoiceNumber('AX-{YYYY}-', 2027, 1234)).toBe('AX-2027-1234');
  });

  it('formats sizes like the UI expects', () => {
    expect(humanSize(500)).toBe('1 KB');
    expect(humanSize(2048)).toBe('2 KB');
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats long dates and initials', () => {
    expect(longDate('2026-01-05')).toBe('5 Jan 2026');
    expect(initials('  ada lovelace  ')).toBe('AL');
    expect(initials('')).toBe('?');
  });

  it('rounds half up to cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('invoice status', () => {
  it('reports a sent invoice past its due date as overdue', () => {
    expect(effectiveStatus('Sent', '2026-01-01', '2026-02-01')).toBe('Overdue');
    expect(effectiveStatus('Sent', '2026-03-01', '2026-02-01')).toBe('Sent');
    expect(effectiveStatus('Paid', '2026-01-01', '2026-02-01')).toBe('Paid');
    expect(effectiveStatus('Draft', '2026-01-01', '2026-02-01')).toBe('Draft');
  });
});

describe('configuration', () => {
  it('parses session lifetimes and falls back to 12 hours', () => {
    expect(parseDurationMs('12h')).toBe(12 * 3_600_000);
    expect(parseDurationMs('30m')).toBe(30 * 60_000);
    expect(parseDurationMs('7d')).toBe(7 * 86_400_000);
    expect(parseDurationMs('forever')).toBe(12 * 3_600_000);
  });

  it('uses the Spring defaults when variables are missing', () => {
    const cfg = loadConfig({});
    expect(cfg.timezone).toBe('Asia/Colombo');
    expect(cfg.billingCron).toBe('0 0 6 * * *');
    expect(cfg.overdueCron).toBe('0 0 7 * * *');
    expect(cfg.corsAllowedOrigins).toEqual(expect.arrayContaining(['https://localhost', 'capacitor://localhost']));
    expect(cfg.maxUploadBytes).toBe(26214400);
  });
});

describe('error mapping', () => {
  it('maps database integrity violations to 409 with the Spring message', () => {
    expect(describeError({ code: '23505' })).toEqual({ status: 409, body: { error: 'The change conflicts with existing data.' } });
    expect(describeError({ code: '23503' }).status).toBe(409);
  });

  it('keeps HTTP exceptions as they are and hides unknown failures', () => {
    expect(describeError(badRequest('Client is required'))).toEqual({ status: 400, body: { error: 'Client is required' } });
    expect(describeError(new Error('boom'))).toEqual({ status: 500, body: { error: 'Internal server error' } });
  });
});

describe('tokens', () => {
  it('hashes tokens with SHA-256 so only the hash is stored', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
