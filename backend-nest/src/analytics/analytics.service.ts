import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config.provider';
import { Db } from '../db/db.service';
import { Member } from '../common/member';
import { Permissions, requireAccess } from '../common/permissions';
import { addDays, todayIn, parseIso } from '../common/time';
import { round2, SHORT_MONTHS } from '../common/format';
import { effectiveStatus } from '../invoices/invoices.service';
import { SettingsService } from '../settings/settings.service';

export interface FinanceAnalyticsDto {
  months: { month: string; label: string; revenue: number; expenses: number; newClients: number }[];
  fiscalYears: { label: string; revenue: number; expenses: number }[];
  cash: { label: string; balance: number }[];
  cashPosition: number;
  outstanding: number;
  overdue: number;
  recurringLast30Days: number;
  monthlyRecurring: number;
}

/** "YYYY-MM" shifted by a number of months. */
function shiftYm(ym: string, months: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Finance time series and balances, derived from ledger, invoice and client records. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: Db,
    private readonly settings: SettingsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async finance(viewer: Member): Promise<FinanceAnalyticsDto> {
    requireAccess(Permissions.finance(viewer.role), 'Your role cannot view finance analytics.');
    const today = todayIn(this.config.timezone);
    const currentYm = today.slice(0, 7);

    const [entriesRes, clientsRes, invoicesRes, subsRes, settings] = await Promise.all([
      this.db.q.query<{ type: string; category: string; txn_date: string; amount: number }>(
        'SELECT type, category, txn_date, amount FROM transactions'),
      this.db.q.query<{ since: string }>('SELECT since FROM clients'),
      this.db.q.query<{ status: string; due_on: string; amount: number }>('SELECT status, due_on, amount FROM invoices'),
      this.db.q.query<{ monthly_amount: number }>("SELECT monthly_amount FROM subscriptions WHERE status = 'Active'"),
      this.settings.current(),
    ]);
    const entries = entriesRes.rows.map(e => ({ ...e, amount: Number(e.amount), ym: e.txn_date.slice(0, 7) }));
    const income = entries.filter(e => e.type === 'Income');
    const expense = entries.filter(e => e.type === 'Expense');
    const sum = (list: { amount: number }[]) => round2(list.reduce((acc, e) => acc + e.amount, 0));
    const opening = Number(settings.opening_cash);

    // Last 12 calendar months, oldest first.
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const ym = shiftYm(currentYm, -i);
      const monthNo = Number(ym.slice(5, 7));
      months.push({
        month: ym,
        label: SHORT_MONTHS[monthNo - 1],
        revenue: sum(income.filter(e => e.ym === ym)),
        expenses: sum(expense.filter(e => e.ym === ym)),
        newClients: clientsRes.rows.filter(c => c.since.slice(0, 7) === ym).length,
      });
    }

    // Last three fiscal years, starting in the configured fiscal-year month.
    const startMonth = settings.fiscal_year_start === 'January' ? 1 : settings.fiscal_year_start === 'April' ? 4 : 7;
    const [ty, tm] = parseIso(today) ? [Number(today.slice(0, 4)), Number(today.slice(5, 7))] : [1970, 1];
    const fyStart = `${tm >= startMonth ? ty : ty - 1}-${String(startMonth).padStart(2, '0')}`;
    const fiscalYears = [];
    for (let k = 2; k >= 0; k--) {
      const start = shiftYm(fyStart, -12 * k);
      const end = shiftYm(start, 12);
      const inRange = (e: { ym: string }) => e.ym >= start && e.ym < end;
      const y = Number(start.slice(0, 4));
      fiscalYears.push({
        label: `FY ${y}/${String((y + 1) % 100).padStart(2, '0')}`,
        revenue: sum(income.filter(inRange)),
        expenses: sum(expense.filter(inRange)),
      });
    }

    // Cash balance at the end of each of the last 12 months.
    const cash = [];
    for (let i = 11; i >= 0; i--) {
      const ym = shiftYm(currentYm, -i);
      const balance = round2(opening + sum(income.filter(e => e.ym <= ym)) - sum(expense.filter(e => e.ym <= ym)));
      cash.push({ label: SHORT_MONTHS[Number(ym.slice(5, 7)) - 1], balance });
    }
    const cashPosition = round2(opening + sum(income) - sum(expense));

    let outstanding = 0;
    let overdue = 0;
    for (const inv of invoicesRes.rows) {
      const status = effectiveStatus(inv.status, inv.due_on, today);
      if (status === 'Sent' || status === 'Overdue') outstanding += Number(inv.amount);
      if (status === 'Overdue') overdue += Number(inv.amount);
    }

    const thirtyDaysAgo = addDays(today, -30);
    const recurring = income.filter(e => e.category === 'Subscription' && e.txn_date >= thirtyDaysAgo);
    const monthlyRecurring = subsRes.rows.reduce((acc, s) => acc + Number(s.monthly_amount), 0);

    return {
      months,
      fiscalYears,
      cash,
      cashPosition,
      outstanding: round2(outstanding),
      overdue: round2(overdue),
      recurringLast30Days: sum(recurring),
      monthlyRecurring: round2(monthlyRecurring),
    };
  }
}
