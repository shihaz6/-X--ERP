import { Injectable } from '@nestjs/common';
import { Db } from '../db/db.service';
import { Member } from '../common/member';
import { badRequest } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { round2 } from '../common/format';
import { AuditService } from '../audit/audit.service';

const CURRENCIES = ['LKR', 'USD', 'EUR'] as const;
const FISCAL_STARTS = ['July', 'January', 'April'] as const;
const TEMPLATES = ['Modern', 'Classic', 'Minimal'] as const;

export interface SettingsRow {
  company_name: string;
  registration_no: string;
  billing_email: string;
  registered_address: string;
  default_currency: string;
  fiscal_year_start: string;
  opening_cash: number;
  invoice_prefix: string;
  invoice_next_number: number;
  invoice_template: string;
  payment_terms: string;
  tax_label: string;
  notify_overdue: boolean;
  notify_new_order: boolean;
  notify_leave: boolean;
  notify_deadline: boolean;
  notify_weekly: boolean;
}

export interface SettingsDto {
  company: { name: string; registrationNo: string; billingEmail: string; address: string };
  currency: string;
  fiscalYearStart: string;
  openingCash: number;
  invoicing: { prefix: string; nextNumber: number; template: string; paymentTerms: string; taxLabel: string };
  notifications: { overdue: boolean; newOrder: boolean; leave: boolean; deadline: boolean; weekly: boolean };
  services: string[];
}

export interface SettingsInput {
  companyName?: string | null;
  registrationNo?: string | null;
  billingEmail?: string | null;
  registeredAddress?: string | null;
  currency?: string | null;
  fiscalYearStart?: string | null;
  openingCash?: number | null;
  invoicePrefix?: string | null;
  invoiceNextNumber?: number | null;
  invoiceTemplate?: string | null;
  paymentTerms?: string | null;
  taxLabel?: string | null;
  notifyOverdue?: boolean | null;
  notifyNewOrder?: boolean | null;
  notifyLeave?: boolean | null;
  notifyDeadline?: boolean | null;
  notifyWeekly?: boolean | null;
}

@Injectable()
export class SettingsService {
  constructor(private readonly db: Db, private readonly audit: AuditService) {}

  async current(): Promise<SettingsRow> {
    const r = await this.db.q.query<SettingsRow>('SELECT * FROM workspace_settings WHERE id = 1');
    if (!r.rows[0]) throw new Error('workspace_settings row is missing');
    return r.rows[0];
  }

  async get(): Promise<SettingsDto> {
    const s = await this.current();
    const services = await this.db.q.query<{ name: string }>('SELECT name FROM service_categories ORDER BY position ASC, name ASC');
    return {
      company: {
        name: s.company_name, registrationNo: s.registration_no, billingEmail: s.billing_email, address: s.registered_address,
      },
      currency: s.default_currency,
      fiscalYearStart: s.fiscal_year_start,
      openingCash: Number(s.opening_cash),
      invoicing: {
        prefix: s.invoice_prefix,
        nextNumber: Number(s.invoice_next_number),
        template: s.invoice_template,
        paymentTerms: s.payment_terms,
        taxLabel: s.tax_label,
      },
      notifications: {
        overdue: s.notify_overdue,
        newOrder: s.notify_new_order,
        leave: s.notify_leave,
        deadline: s.notify_deadline,
        weekly: s.notify_weekly,
      },
      services: services.rows.map(r => r.name),
    };
  }

  /** Partial update: fields that are null in the request are left unchanged. */
  async update(actor: Member, req: SettingsInput): Promise<void> {
    requireAccess(Permissions.admin(actor.role), 'Only a Super Admin can change workspace settings.');
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    const str = (v: string | null | undefined) => (v == null ? undefined : v.trim());

    if (req.companyName != null) set('company_name', req.companyName.trim());
    if (req.registrationNo != null) set('registration_no', req.registrationNo.trim());
    if (req.billingEmail != null) set('billing_email', req.billingEmail.trim() === '' ? '' : V.email(req.billingEmail));
    if (req.registeredAddress != null) set('registered_address', req.registeredAddress.trim());
    if (req.currency != null) set('default_currency', V.oneOf(req.currency, 'Currency', CURRENCIES));
    if (req.fiscalYearStart != null) set('fiscal_year_start', V.oneOf(req.fiscalYearStart, 'Fiscal year start', FISCAL_STARTS));
    if (req.openingCash != null) set('opening_cash', round2(req.openingCash));
    if (req.invoicePrefix != null) set('invoice_prefix', V.required(req.invoicePrefix, 'Invoice prefix'));
    if (req.invoiceNextNumber != null) {
      if (req.invoiceNextNumber < 1) throw badRequest('Next invoice number must be at least 1');
      set('invoice_next_number', Math.trunc(req.invoiceNextNumber));
    }
    if (req.invoiceTemplate != null) set('invoice_template', V.oneOf(req.invoiceTemplate, 'Template', TEMPLATES));
    if (req.paymentTerms != null) set('payment_terms', str(req.paymentTerms));
    if (req.taxLabel != null) set('tax_label', str(req.taxLabel));
    if (req.notifyOverdue != null) set('notify_overdue', req.notifyOverdue);
    if (req.notifyNewOrder != null) set('notify_new_order', req.notifyNewOrder);
    if (req.notifyLeave != null) set('notify_leave', req.notifyLeave);
    if (req.notifyDeadline != null) set('notify_deadline', req.notifyDeadline);
    if (req.notifyWeekly != null) set('notify_weekly', req.notifyWeekly);

    await this.db.tx(async tx => {
      if (sets.length) await tx.query(`UPDATE workspace_settings SET ${sets.join(', ')} WHERE id = 1`, params);
      await this.audit.record(tx, actor, 'Updated workspace settings');
    });
  }

  async replaceServices(actor: Member, names: string[] | null | undefined): Promise<void> {
    requireAccess(Permissions.admin(actor.role), 'Only a Super Admin can change service categories.');
    if (!Array.isArray(names)) throw badRequest('Services are required');
    const unique = [...new Set(names.filter((n): n is string => typeof n === 'string' && n.trim() !== '').map(n => n.trim()))];
    if (!unique.length) throw badRequest('At least one service category is required');
    await this.db.tx(async tx => {
      await tx.query('DELETE FROM service_categories');
      for (let i = 0; i < unique.length; i++) {
        await tx.query('INSERT INTO service_categories (name, position) VALUES ($1, $2)', [unique[i], i + 1]);
      }
      await this.audit.record(tx, actor, 'Updated service categories');
    });
  }
}
