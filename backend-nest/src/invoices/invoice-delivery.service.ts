import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../db/db.service';
import { Member } from '../common/member';
import { conflict, notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import { amount2 } from '../common/format';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { InvoicePdfService, InvoiceSettings } from './invoice-pdf.service';
import { InvoicesService, InvoiceRow } from './invoices.service';
import { todayIn } from '../common/time';
import { AppConfig, CONFIG } from '../config.provider';

interface SettingsRow extends InvoiceSettings {
  notify_overdue: boolean;
}

/** Invoice PDFs, emailing invoices to clients, and overdue reminders to the billing address. */
@Injectable()
export class InvoiceDeliveryService {
  constructor(
    private readonly db: Db,
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Marks a draft as sent and emails the PDF to the client. Sent invoices can be emailed again. */
  async send(actor: Member, id: string): Promise<{ emailed: boolean }> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot send invoices.');
    const inv = await this.db.tx(async tx => {
      const row = await this.invoices.find(tx, id, true);
      if (row.status === 'Paid') throw conflict('A paid invoice cannot be sent again');
      if (row.status === 'Draft') await this.invoices.markSent(tx, actor, row);
      return this.invoices.find(tx, id, false);
    });

    const client = await this.db.q.query<{ name: string; contact: string; email: string }>(
      'SELECT name, contact, email FROM clients WHERE id = $1', [inv.client_id]);
    if (!client.rows[0]) throw notFound('Client not found');
    const s = await this.settings();
    const document = await this.pdf.render(inv, client.rows[0].name, s);
    const company = s.company_name?.trim() ? s.company_name : 'AlchemyX';
    const body = `Dear ${client.rows[0].contact},\n\nPlease find invoice ${inv.id} attached.\n`
      + `Amount due: LKR ${amount2(Number(inv.amount))}\n`
      + `Due date: ${inv.due_on}\n\nThank you,\n${company}`;

    const sent = await this.mail.send(client.rows[0].email, `Invoice ${inv.id} from ${company}`, body,
      { name: `${inv.id}.pdf`, content: document });
    await this.audit.record(this.db.q, actor, sent
      ? `Emailed invoice ${inv.id} to ${client.rows[0].email}`
      : `Marked invoice ${inv.id} sent (email not delivered: mail is not configured)`);
    return { emailed: sent };
  }

  async pdfFor(viewer: Member, id: string): Promise<Buffer> {
    requireAccess(Permissions.finance(viewer.role), 'Your role cannot view invoices.');
    const inv: InvoiceRow = await this.invoices.find(this.db.q, id, false);
    const client = await this.db.q.query<{ name: string }>('SELECT name FROM clients WHERE id = $1', [inv.client_id]);
    return this.pdf.render(inv, client.rows[0]?.name ?? null, await this.settings());
  }

  /** Daily job: lists overdue invoices to the billing address when the overdue alert is switched on. */
  async sendOverdueReminders(): Promise<void> {
    const s = await this.settings();
    if (!s.notify_overdue || !s.billing_email?.trim()) return;
    const today = todayIn(this.config.timezone);
    const overdue = (await this.db.q.query<InvoiceRow & { client_name: string | null }>(
      `SELECT i.id, i.client_id, i.order_id, i.description, i.amount, i.issued_on, i.due_on, i.status,
              c.name AS client_name
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.status = 'Sent' AND i.due_on < $1 ORDER BY i.due_on`, [today])).rows;
    if (!overdue.length) return;
    const lines = overdue.map(i => `${i.id}  ${i.client_name ?? '—'}  LKR ${amount2(Number(i.amount))}  due ${i.due_on}`);
    await this.mail.send(s.billing_email, `Overdue invoices: ${overdue.length}`,
      `These invoices are past their due date:\n\n${lines.join('\n')}\n`);
  }

  private async settings(): Promise<SettingsRow> {
    const r = await this.db.q.query<SettingsRow>(
      `SELECT company_name, registration_no, billing_email, registered_address, payment_terms, tax_label,
              invoice_template, notify_overdue FROM workspace_settings WHERE id = 1`);
    if (!r.rows[0]) throw new Error('workspace_settings row is missing');
    return r.rows[0];
  }
}
