import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfig, CONFIG } from '../config.provider';
import { Db } from '../db/db.service';
import { Member } from '../common/member';
import { notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { todayIn } from '../common/time';
import { AuditService } from '../audit/audit.service';

const LEDGER_CATEGORIES: Record<'Income' | 'Expense', readonly string[]> = {
  Income: ['Client Payment', 'Subscription', 'Consulting Fee', 'Other Income'],
  Expense: ['Salaries', 'Cloud Infrastructure', 'Software', 'Rent', 'Marketing', 'Travel', 'Other'],
};

interface LedgerDto {
  id: string;
  date: string;
  desc: string;
  category: string;
  type: string;
  amount: number;
  projectId: string | null;
}

interface LedgerRow {
  id: string;
  txn_date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  project_id: string | null;
}

const toDto = (r: LedgerRow): LedgerDto => ({
  id: r.id,
  date: r.txn_date,
  desc: r.description,
  category: r.category,
  type: r.type,
  amount: Number(r.amount),
  projectId: r.project_id,
});

@Injectable()
export class LedgerService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Newest entries first, for the dashboard and the workspace snapshot. */
  async recent(viewer: Member, limit: number): Promise<LedgerDto[]> {
    requireAccess(Permissions.finance(viewer.role), 'Your role cannot view transactions.');
    const rows = await this.db.q.query<LedgerRow>(
      `SELECT id, txn_date, description, category, type, amount, project_id FROM transactions
       ORDER BY txn_date DESC, created_at DESC LIMIT $1`, [limit]);
    return rows.rows.map(toDto);
  }

  async page(viewer: Member, page: number, size: number): Promise<{ items: LedgerDto[]; total: number; page: number; size: number }> {
    requireAccess(Permissions.finance(viewer.role), 'Your role cannot view transactions.');
    const p = Math.max(0, page);
    const s = Math.min(100, Math.max(1, size));
    const total = await this.db.q.query<{ n: number }>('SELECT count(*)::int AS n FROM transactions');
    const rows = await this.db.q.query<LedgerRow>(
      `SELECT id, txn_date, description, category, type, amount, project_id FROM transactions
       ORDER BY txn_date DESC, created_at DESC LIMIT $1 OFFSET $2`, [s, p * s]);
    return { items: rows.rows.map(toDto), total: total.rows[0].n, page: p, size: s };
  }

  async create(actor: Member, req: {
    type?: string; description?: string; category?: string; amount?: number; date?: string | null; projectId?: string | null;
  }): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Your role cannot record transactions.');
    const type = V.oneOf(req.type, 'Type', ['Income', 'Expense'] as const);
    const category = V.oneOf(req.category, 'Category', LEDGER_CATEGORIES[type]);
    const projectId = V.optionalUuid(req.projectId, 'Project');
    if (projectId && !(await this.db.q.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rowCount) {
      throw notFound('Project not found');
    }
    const date = req.date == null || !req.date.trim() ? todayIn(this.config.timezone) : V.date(req.date, 'Date');
    const description = V.required(req.description, 'Description');
    const amount = V.positive(req.amount, 'Amount');
    await this.db.tx(async tx => {
      await tx.query(
        `INSERT INTO transactions (id, txn_date, description, category, type, amount, project_id, invoice_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, now())`,
        [randomUUID(), date, description, category, type, amount, projectId]);
      await this.audit.record(tx, actor, `Recorded ${type.toLowerCase()}: ${description}`);
    });
  }
}
