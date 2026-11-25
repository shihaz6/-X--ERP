import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfig, CONFIG } from '../config.provider';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { badRequest, conflict, notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { todayIn } from '../common/time';
import { AuditService } from '../audit/audit.service';
import { MembersService } from '../members/members.service';

export const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
const NOTE_TYPES = ['Meeting', 'Call', 'Email'] as const;

export interface ClientNoteDto {
  date: string | null;
  type: string;
  text: string;
}

export interface ClientDto {
  id: string;
  name: string;
  industry: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  stage: string;
  value: number;
  owner: string;
  followUp: string | null;
  since: string | null;
  notes: ClientNoteDto[];
}

export interface ClientInput {
  name?: string | null;
  industry?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  stage?: string | null;
  value?: number | null;
  followUp?: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  industry: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  stage: string;
  value: number;
  owner_id: string | null;
  follow_up: string | null;
  since: string;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly members: MembersService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Non-CRM roles get the client name and industry only, never deal value, notes or contact details. */
  async list(viewer: Member): Promise<ClientDto[]> {
    const crm = Permissions.crm(viewer.role);
    const names = await this.members.namesById();
    const rows = await this.db.q.query<ClientRow>(
      'SELECT id, name, industry, contact, email, phone, city, stage, value, owner_id, follow_up, since FROM clients ORDER BY name ASC');
    const notes = crm ? await this.notesByClient() : new Map<string, ClientNoteDto[]>();
    return rows.rows.map(c => this.toDto(c, names, crm, notes.get(c.id) ?? []));
  }

  private async notesByClient(): Promise<Map<string, ClientNoteDto[]>> {
    const rows = await this.db.q.query<{ client_id: string; note_date: string; type: string; text: string }>(
      'SELECT client_id, note_date, type, text FROM client_notes ORDER BY created_at DESC');
    const map = new Map<string, ClientNoteDto[]>();
    for (const r of rows.rows) {
      const list = map.get(r.client_id) ?? [];
      list.push({ date: r.note_date, type: r.type, text: r.text });
      map.set(r.client_id, list);
    }
    return map;
  }

  toDto(c: ClientRow, names: Map<string, string>, crm: boolean, notes: ClientNoteDto[]): ClientDto {
    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      contact: crm ? c.contact : '',
      email: crm ? c.email : '',
      phone: crm ? c.phone : '',
      city: c.city,
      stage: c.stage,
      value: crm ? Number(c.value) : 0,
      owner: crm && c.owner_id ? names.get(c.owner_id) ?? '—' : '—',
      followUp: c.follow_up,
      since: c.since,
      notes: crm ? notes : [],
    };
  }

  async create(actor: Member, req: ClientInput): Promise<void> {
    requireAccess(Permissions.editCrm(actor.role), 'Your role cannot add clients.');
    const stage = req.stage == null ? 'Lead' : V.oneOf(req.stage, 'Stage', STAGES);
    const name = V.required(req.name, 'Organisation name');
    const industry = req.industry == null || !req.industry.trim() ? 'Technology' : req.industry.trim();
    const contact = V.required(req.contact, 'Primary contact');
    const email = V.email(req.email);
    const value = req.value == null ? 0 : V.nonNegative(req.value, 'Deal value');
    const followUp = V.optionalDate(req.followUp, 'Follow-up date');
    await this.db.tx(async tx => {
      await tx.query(
        `INSERT INTO clients (id, name, industry, contact, email, phone, city, stage, value, owner_id, follow_up, since, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
        [randomUUID(), name, industry, contact, email, (req.phone ?? '').trim(), (req.city ?? '').trim(), stage, value,
          actor.id, followUp, todayIn(this.config.timezone)],
      );
      await this.audit.record(tx, actor, `Created client ${name}`);
    });
  }

  async update(actor: Member, id: string, req: ClientInput): Promise<void> {
    requireAccess(Permissions.editCrm(actor.role), 'Your role cannot edit clients.');
    await this.db.tx(async tx => {
      const c = await this.find(tx, id, true);
      const sets: string[] = [];
      const params: unknown[] = [];
      const set = (column: string, value: unknown) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };
      if (req.stage != null && req.stage !== c.stage) {
        const stage = V.oneOf(req.stage, 'Stage', STAGES);
        set('stage', stage);
        await this.audit.record(tx, actor, `Moved ${c.name} to ${stage}`);
      }
      if (req.name != null) set('name', V.required(req.name, 'Organisation name'));
      if (req.industry != null) set('industry', req.industry.trim());
      if (req.contact != null) set('contact', V.required(req.contact, 'Primary contact'));
      if (req.email != null) set('email', V.email(req.email));
      if (req.phone != null) set('phone', req.phone.trim());
      if (req.city != null) set('city', req.city.trim());
      if (req.value != null) set('value', V.nonNegative(req.value, 'Deal value'));
      if (req.followUp != null) set('follow_up', V.optionalDate(req.followUp, 'Follow-up date'));
      if (sets.length) {
        params.push(id);
        await tx.query(`UPDATE clients SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      }
    });
  }

  async delete(actor: Member, id: string): Promise<void> {
    requireAccess(Permissions.editCrm(actor.role), 'Your role cannot delete clients.');
    await this.db.tx(async tx => {
      const c = await this.find(tx, id, true);
      const linked = await tx.query<{ linked: boolean }>(
        `SELECT (EXISTS (SELECT 1 FROM projects WHERE client_id = $1)
              OR EXISTS (SELECT 1 FROM orders WHERE client_id = $1)
              OR EXISTS (SELECT 1 FROM invoices WHERE client_id = $1)
              OR EXISTS (SELECT 1 FROM subscriptions WHERE client_id = $1)
              OR EXISTS (SELECT 1 FROM documents WHERE client_id = $1)) AS linked`, [id]);
      if (linked.rows[0].linked) {
        throw conflict('This client still has projects, orders, invoices, subscriptions or documents. Remove those first.');
      }
      await tx.query('DELETE FROM clients WHERE id = $1', [id]);
      await this.audit.record(tx, actor, `Deleted client ${c.name}`);
    });
  }

  async addNote(actor: Member, id: string, req: { type?: string; text?: string }): Promise<void> {
    requireAccess(Permissions.editCrm(actor.role), 'Your role cannot log activity.');
    await this.db.tx(async tx => {
      const c = await this.find(tx, id, false);
      const type = V.oneOf(req.type, 'Activity type', NOTE_TYPES);
      const text = V.required(req.text, 'Note');
      await tx.query(
        `INSERT INTO client_notes (id, client_id, note_date, type, text, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [randomUUID(), id, todayIn(this.config.timezone), type, text, actor.id],
      );
      await this.audit.record(tx, actor, `Logged ${type.toLowerCase()} with ${c.name}`);
    });
  }

  async find(q: Queryable, id: string, lock: boolean): Promise<{ name: string; stage: string }> {
    if (!id) throw badRequest('Client is required');
    const r = await q.query<{ name: string; stage: string }>(
      `SELECT name, stage FROM clients WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!r.rows[0]) throw notFound('Client not found');
    return r.rows[0];
  }
}
