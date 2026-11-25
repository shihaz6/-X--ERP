import { Injectable } from '@nestjs/common';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { notFound, conflict, badRequest } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { todayIn } from '../common/time';
import { AuditService } from '../audit/audit.service';
import { AppConfig, CONFIG } from '../config.provider';
import { Inject } from '@nestjs/common';

export const ORDER_STATUSES = ['Pending', 'Approved', 'In Progress', 'Delivered', 'Completed', 'Cancelled'] as const;

export interface OrderDto {
  id: string;
  title: string;
  clientId: string;
  projectId: string | null;
  service: string;
  amount: number;
  status: string;
  created: string;
  delivery: string;
  spec: string;
}

export interface OrderInput {
  title?: string;
  clientId?: string;
  projectId?: string | null;
  service?: string;
  amount?: number;
  delivery?: string;
  spec?: string | null;
}

export interface OrderRow {
  id: string;
  title: string;
  client_id: string;
  project_id: string | null;
  service: string;
  amount: number;
  status: string;
  created_on: string;
  delivery_date: string;
  spec: string;
}

const ORDER_COLUMNS = 'id, title, client_id, project_id, service, amount, status, created_on, delivery_date, spec';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async list(viewer: Member): Promise<OrderDto[]> {
    requireAccess(Permissions.orders(viewer.role), 'Your role cannot view orders.');
    const rows = await this.db.q.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders ORDER BY id DESC`);
    return rows.rows.map(toDto);
  }

  async create(actor: Member, req: OrderInput): Promise<void> {
    requireAccess(Permissions.orders(actor.role), 'Your role cannot create orders.');
    const clientId = V.uuid(req.clientId, 'Client');
    await this.db.tx(async tx => {
      if (!(await tx.query('SELECT 1 FROM clients WHERE id = $1', [clientId])).rowCount) {
        throw notFound('Client not found');
      }
      const projectId = V.optionalUuid(req.projectId, 'Project');
      if (projectId) {
        const p = await tx.query<{ client_id: string | null }>('SELECT client_id FROM projects WHERE id = $1', [projectId]);
        if (!p.rows[0]) throw notFound('Project not found');
        if (p.rows[0].client_id && p.rows[0].client_id !== clientId) {
          throw badRequest('The project belongs to a different client');
        }
      }
      const allowed = (await tx.query<{ name: string }>('SELECT name FROM service_categories')).rows.map(r => r.name);
      const service = V.oneOf(req.service, 'Service', allowed);
      const delivery = V.date(req.delivery, 'Delivery date');
      const title = V.required(req.title, 'Order title');
      const amount = V.positive(req.amount, 'Price');
      const spec = req.spec == null || !req.spec.trim() ? '—' : req.spec.trim();

      const seq = await tx.query<{ n: number }>("SELECT nextval('order_seq')::int AS n");
      const id = `ORD-${seq.rows[0].n}`;
      await tx.query(
        `INSERT INTO orders (id, title, client_id, project_id, service, amount, status, created_on, delivery_date, spec, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, $8, $9, now())`,
        [id, title, clientId, projectId, service, amount, todayIn(this.config.timezone), delivery, spec]);
      await this.audit.record(tx, actor, `Created order ${id}`);
    });
  }

  async setStatus(actor: Member, id: string, status: string | undefined): Promise<void> {
    requireAccess(Permissions.orders(actor.role), 'Your role cannot change orders.');
    await this.db.tx(async tx => {
      const o = await this.find(tx, id, true);
      if (o.status === 'Cancelled') throw conflict('A cancelled order cannot be changed');
      const next = V.oneOf(status, 'Status', ORDER_STATUSES);
      await tx.query('UPDATE orders SET status = $1 WHERE id = $2', [next, id]);
      await this.audit.record(tx, actor, `Set ${id} status to ${next}`);
    });
  }

  async find(q: Queryable, id: string, lock: boolean): Promise<OrderRow> {
    const r = await q.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!r.rows[0]) throw notFound('Order not found');
    return r.rows[0];
  }
}

export function toDto(o: OrderRow): OrderDto {
  return {
    id: o.id,
    title: o.title,
    clientId: o.client_id,
    projectId: o.project_id,
    service: o.service,
    amount: Number(o.amount),
    status: o.status,
    created: o.created_on,
    delivery: o.delivery_date,
    spec: o.spec,
  };
}
