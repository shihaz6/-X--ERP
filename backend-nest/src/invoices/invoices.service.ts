import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfig, CONFIG } from '../config.provider';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { badRequest, conflict, notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { addDays, todayIn, parseIso } from '../common/time';
import { invoiceNumber } from '../common/format';
import { AuditService } from '../audit/audit.service';

export const INVOICE_TERM_DAYS = 30;

export interface InvoiceDto {
  id: string;
  clientId: string;
  orderId: string | null;
  amount: number;
  issued: string;
  due: string;
  status: string;
  description: string;
}

export interface InvoiceRow {
  id: string;
  client_id: string;
  order_id: string | null;
  description: string;
  amount: number;
  issued_on: string;
  due_on: string;
  status: string;
}

/** "Overdue" is not stored. A sent invoice past its due date is reported as overdue. */
export function effectiveStatus(status: string, dueOn: string, today: string): string {
  return status === 'Sent' && dueOn < today ? 'Overdue' : status;
}

export function toDto(i: InvoiceRow, today: string): InvoiceDto {
  return {
    id: i.id,
    clientId: i.client_id,
    orderId: i.order_id,
    amount: Number(i.amount),
    issued: i.issued_on,
    due: i.due_on,
    status: effectiveStatus(i.status, i.due_on, today),
    description: i.description,
  };
}

const INVOICE_COLUMNS = 'id, client_id, order_id, description, amount, issued_on, due_on, status';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  today(): string {
    return todayIn(this.config.timezone);
  }

  async list(viewer: Member): Promise<InvoiceDto[]> {
    requireAccess(Permissions.finance(viewer.role), 'Your role cannot view invoices.');
    const today = this.today();
    const rows = await this.db.q.query<InvoiceRow>(
      `SELECT ${INVOICE_COLUMNS} FROM invoices ORDER BY issued_on DESC, id DESC`);
    return rows.rows.map(r => toDto(r, today));
  }

  async create(actor: Member, req: {
    clientId?: string; orderId?: string | null; description?: string; amount?: number; due?: string; status?: string | null;
  }): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot issue invoices.');
    const clientId = V.uuid(req.clientId, 'Client');
    await this.db.tx(async tx => {
      if (!(await tx.query('SELECT 1 FROM clients WHERE id = $1', [clientId])).rowCount) {
        throw notFound('Client not found');
      }
      const orderId = req.orderId == null || !req.orderId.trim() ? null : req.orderId.trim();
      if (orderId) {
        const o = await tx.query<{ client_id: string }>('SELECT client_id FROM orders WHERE id = $1', [orderId]);
        if (!o.rows[0]) throw notFound('Order not found');
        if (o.rows[0].client_id !== clientId) throw badRequest('The order belongs to a different client');
      }
      const issued = this.today();
      const due = V.date(req.due, 'Due date');
      V.notBefore(due, issued, 'Due date cannot be before the issue date');
      const status = req.status == null ? 'Draft' : V.oneOf(req.status, 'Status', ['Draft', 'Sent'] as const);
      const description = V.required(req.description, 'Line item description');
      const amount = V.positive(req.amount, 'Amount');
      const id = await this.nextInvoiceNumber(tx, issued);
      await tx.query(
        `INSERT INTO invoices (id, client_id, order_id, description, amount, issued_on, due_on, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [id, clientId, orderId, description, amount, issued, due, status]);
      await this.audit.record(tx, actor, `Created invoice ${id}`);
    });
  }

  /** Draft invoice for an order, due in 30 days, with the order value as the amount. */
  async createFromOrder(actor: Member, orderId: string): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot issue invoices.');
    await this.db.tx(async tx => {
      const o = await tx.query<{ id: string; client_id: string; title: string; amount: number; status: string }>(
        'SELECT id, client_id, title, amount, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = o.rows[0];
      if (!order) throw notFound('Order not found');
      if (order.status === 'Cancelled') throw conflict('A cancelled order cannot be invoiced');
      const issued = this.today();
      const id = await this.nextInvoiceNumber(tx, issued);
      await tx.query(
        `INSERT INTO invoices (id, client_id, order_id, description, amount, issued_on, due_on, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', now())`,
        [id, order.client_id, order.id, order.title, Number(order.amount), issued, addDays(issued, INVOICE_TERM_DAYS)]);
      await this.audit.record(tx, actor, `Generated invoice ${id} from ${order.id}`);
    });
  }

  /** Only drafts can be deleted. Sent and paid invoices stay on record. */
  async delete(actor: Member, id: string): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot delete invoices.');
    await this.db.tx(async tx => {
      const inv = await this.find(tx, id, true);
      if (inv.status !== 'Draft') {
        throw conflict('Only draft invoices can be deleted. Sent and paid invoices are kept on record.');
      }
      await tx.query('DELETE FROM invoices WHERE id = $1', [id]);
      await this.audit.record(tx, actor, `Deleted draft invoice ${id}`);
    });
  }

  /** Draft invoice with a server-issued number, used by recurring billing. Runs inside the caller's transaction. */
  async issueInvoice(tx: Queryable, actor: Member | null, clientId: string, description: string, amount: number, due: string): Promise<string> {
    const issued = this.today();
    const id = await this.nextInvoiceNumber(tx, issued);
    await tx.query(
      `INSERT INTO invoices (id, client_id, order_id, description, amount, issued_on, due_on, status, created_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, 'Draft', now())`,
      [id, clientId, description, amount, issued, due]);
    await this.audit.record(tx, actor, `Created invoice ${id}`);
    return id;
  }

  async setStatus(actor: Member, id: string, status: string | undefined): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot change invoices.');
    await this.db.tx(async tx => {
      const inv = await this.find(tx, id, true);
      const next = V.oneOf(status, 'Status', ['Sent', 'Paid'] as const);
      if (next === 'Sent') {
        await this.markSent(tx, actor, inv);
        return;
      }
      if (inv.status !== 'Draft' && inv.status !== 'Sent') throw conflict('This invoice is already paid');
      await tx.query("UPDATE invoices SET status = 'Paid' WHERE id = $1", [id]);
      const client = await tx.query<{ name: string }>('SELECT name FROM clients WHERE id = $1', [inv.client_id]);
      const clientName = client.rows[0]?.name ?? 'client';
      await tx.query(
        `INSERT INTO transactions (id, txn_date, description, category, type, amount, project_id, invoice_id, created_at)
         VALUES ($1, $2, $3, 'Client Payment', 'Income', $4, NULL, $5, now())`,
        [randomUUID(), this.today(), `Payment — ${clientName}`, Number(inv.amount), id]);
      await this.audit.record(tx, actor, `Marked ${id} as Paid`);
    });
  }

  /** Moves a draft to Sent. Sent invoices are left as they are. */
  async markSent(tx: Queryable, actor: Member | null, inv: InvoiceRow): Promise<void> {
    if (inv.status !== 'Draft') throw conflict('Only draft invoices can be sent');
    await tx.query("UPDATE invoices SET status = 'Sent' WHERE id = $1", [inv.id]);
    await this.audit.record(tx, actor, `Sent invoice ${inv.id}`);
  }

  async find(q: Queryable, id: string, lock: boolean): Promise<InvoiceRow> {
    const r = await q.query<InvoiceRow>(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!r.rows[0]) throw notFound('Invoice not found');
    return r.rows[0];
  }

  /**
   * Next invoice number. The settings row is locked so concurrent requests get different numbers.
   */
  async nextInvoiceNumber(q: Queryable, issuedIso: string): Promise<string> {
    const s = await q.query<{ prefix: string; next: number }>(
      'SELECT invoice_prefix AS prefix, invoice_next_number AS next FROM workspace_settings WHERE id = 1 FOR UPDATE');
    if (!s.rows[0]) throw new Error('workspace_settings row is missing');
    const year = parseIso(issuedIso)?.[0] ?? new Date().getUTCFullYear();
    const number = invoiceNumber(s.rows[0].prefix, year, s.rows[0].next);
    await q.query('UPDATE workspace_settings SET invoice_next_number = $1 WHERE id = 1', [s.rows[0].next + 1]);
    return number;
  }
}
