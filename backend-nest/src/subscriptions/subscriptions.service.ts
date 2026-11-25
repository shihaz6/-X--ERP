import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfig, CONFIG } from '../config.provider';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { conflict, notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { addMonths, addDays, todayIn, parseIso } from '../common/time';
import { FULL_MONTHS } from '../common/format';
import { AuditService } from '../audit/audit.service';
import { InvoicesService, INVOICE_TERM_DAYS } from '../invoices/invoices.service';

export const SUBSCRIPTION_STATUSES = ['Active', 'Paused', 'Cancelled'] as const;

export interface SubscriptionDto {
  id: string;
  clientId: string;
  clientName: string;
  plan: string;
  monthlyAmount: number;
  start: string;
  nextBilling: string;
  status: string;
}

interface SubscriptionRow {
  id: string;
  client_id: string;
  client_name: string | null;
  plan: string;
  monthly_amount: number;
  start_date: string;
  next_billing_date: string;
  status: string;
}

const SELECT_SUBSCRIPTIONS = `SELECT s.id, s.client_id, c.name AS client_name, s.plan, s.monthly_amount,
  s.start_date, s.next_billing_date, s.status
  FROM subscriptions s LEFT JOIN clients c ON c.id = s.client_id`;

const toDto = (s: SubscriptionRow): SubscriptionDto => ({
  id: s.id,
  clientId: s.client_id,
  clientName: s.client_name ?? '—',
  plan: s.plan,
  monthlyAmount: Number(s.monthly_amount),
  start: s.start_date,
  nextBilling: s.next_billing_date,
  status: s.status,
});

/** Recurring client subscriptions. Each billing run drafts an invoice and moves the billing date forward one month. */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async list(viewer: Member): Promise<SubscriptionDto[]> {
    requireAccess(Permissions.finance(viewer.role), 'Your role cannot view subscriptions.');
    const rows = await this.db.q.query<SubscriptionRow>(`${SELECT_SUBSCRIPTIONS} ORDER BY s.next_billing_date ASC`);
    return rows.rows.map(toDto);
  }

  async create(actor: Member, req: { clientId?: string; plan?: string; monthlyAmount?: number; start?: string }): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot add subscriptions.');
    const clientId = V.uuid(req.clientId, 'Client');
    await this.db.tx(async tx => {
      const client = await tx.query<{ name: string }>('SELECT name FROM clients WHERE id = $1', [clientId]);
      if (!client.rows[0]) throw notFound('Client not found');
      const plan = V.required(req.plan, 'Plan name');
      const amount = V.positive(req.monthlyAmount, 'Monthly amount');
      const start = V.date(req.start, 'Start date');
      await tx.query(
        `INSERT INTO subscriptions (id, client_id, plan, monthly_amount, start_date, next_billing_date, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $5, 'Active', now())`,
        [randomUUID(), clientId, plan, amount, start]);
      await this.audit.record(tx, actor, `Created subscription ${plan} for ${client.rows[0].name}`);
    });
  }

  async setStatus(actor: Member, id: string, status: string | undefined): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot change subscriptions.');
    await this.db.tx(async tx => {
      const s = await this.find(tx, id, true);
      if (s.status === 'Cancelled') throw conflict('A cancelled subscription cannot be changed');
      const next = V.oneOf(status, 'Status', SUBSCRIPTION_STATUSES);
      await tx.query('UPDATE subscriptions SET status = $1 WHERE id = $2', [next, id]);
      await this.audit.record(tx, actor, `Set subscription ${s.plan} to ${next}`);
    });
  }

  /** Issues the next period's invoice for one active subscription. */
  async bill(actor: Member, id: string): Promise<string> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot bill subscriptions.');
    return this.db.tx(tx => this.billOne(tx, actor, id));
  }

  /** Bills every active subscription whose billing date has arrived. */
  async billDue(actor: Member): Promise<number> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot bill subscriptions.');
    return this.billDueInternal(actor);
  }

  /** Same as billDue, run by the daily scheduler with no signed-in user. */
  billDueAsSystem(): Promise<number> {
    return this.billDueInternal(null);
  }

  private async billDueInternal(actor: Member | null): Promise<number> {
    const today = todayIn(this.config.timezone);
    return this.db.tx(async tx => {
      const due = await tx.query<{ id: string }>(
        `SELECT id FROM subscriptions WHERE status = 'Active' AND next_billing_date <= $1 FOR UPDATE`, [today]);
      for (const row of due.rows) {
        await this.billOne(tx, actor, row.id);
      }
      return due.rows.length;
    });
  }

  private async billOne(tx: Queryable, actor: Member | null, id: string): Promise<string> {
    const s = await this.find(tx, id, true);
    if (s.status !== 'Active') throw conflict('Only active subscriptions can be billed');
    const [y, m] = parseIso(s.next_billing_date) ?? [1970, 1, 1];
    const description = `Subscription ${s.plan} - ${FULL_MONTHS[m - 1]} ${y}`;
    const due = addDays(todayIn(this.config.timezone), INVOICE_TERM_DAYS);
    const invoiceId = await this.invoices.issueInvoice(tx, actor, s.client_id, description, Number(s.monthly_amount), due);
    await tx.query('UPDATE subscriptions SET next_billing_date = $1 WHERE id = $2', [addMonths(s.next_billing_date, 1), id]);
    await this.audit.record(tx, actor, `Billed subscription ${s.plan} as ${invoiceId}`);
    return invoiceId;
  }

  async find(q: Queryable, id: string, lock: boolean): Promise<SubscriptionRow> {
    const r = await q.query<SubscriptionRow>(
      `${SELECT_SUBSCRIPTIONS} WHERE s.id = $1${lock ? ' FOR UPDATE OF s' : ''}`, [id]);
    if (!r.rows[0]) throw notFound('Subscription not found');
    return r.rows[0];
  }
}
