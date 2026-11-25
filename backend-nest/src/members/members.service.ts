import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppConfig, CONFIG } from '../config.provider';
import { Db, Queryable } from '../db/db.service';
import { Member, MEMBER_COLUMNS } from '../common/member';
import { badRequest, conflict, notFound } from '../common/errors';
import { ROLE_LABELS, Role, Permissions, parseRole, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { addDays, mondayOf, todayIn } from '../common/time';
import { initials } from '../common/format';
import { AuditService } from '../audit/audit.service';

export interface MemberDto {
  id: string;
  name: string;
  email: string;
  role: string;
  dept: string;
  access: string;
  hours: number;
  capacity: number;
  status: string;
  initials: string;
}

export interface WeekView {
  hours: Map<string, number>;
  onLeave: Set<string>;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Hours logged this week and members on approved leave today. Used for the member cards. */
  async currentWeek(q: Queryable = this.db.q): Promise<WeekView> {
    const today = todayIn(this.config.timezone);
    const monday = mondayOf(today);
    const hours = new Map<string, number>();
    const rows = await q.query<{ member_id: string; hours: number }>(
      'SELECT member_id, sum(hours)::int AS hours FROM timesheet_entries WHERE work_date BETWEEN $1 AND $2 GROUP BY member_id',
      [monday, addDays(monday, 6)],
    );
    rows.rows.forEach(r => hours.set(r.member_id, Number(r.hours)));
    const leave = await q.query<{ member_id: string }>(
      `SELECT member_id FROM leave_requests WHERE status = 'Approved' AND from_date <= $1 AND to_date >= $1`,
      [today],
    );
    return { hours, onLeave: new Set(leave.rows.map(r => r.member_id)) };
  }

  async list(): Promise<MemberDto[]> {
    const view = await this.currentWeek();
    const rows = await this.db.q.query<Member>(`SELECT ${MEMBER_COLUMNS} FROM members ORDER BY name ASC`);
    return rows.rows.map(m => this.toDto(m, view));
  }

  async namesById(q: Queryable = this.db.q): Promise<Map<string, string>> {
    const rows = await q.query<{ id: string; name: string }>('SELECT id, name FROM members');
    return new Map(rows.rows.map(r => [r.id, r.name]));
  }

  async dto(member: Member): Promise<MemberDto> {
    return this.toDto(member, await this.currentWeek());
  }

  toDto(m: Member, view: WeekView): MemberDto {
    const status = view.onLeave.has(m.id) ? 'On Leave' : m.availability;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.jobTitle,
      dept: m.department,
      access: ROLE_LABELS[m.role],
      hours: view.hours.get(m.id) ?? 0,
      capacity: m.capacityHours,
      status,
      initials: m.initials,
    };
  }

  async create(actor: Member, req: MemberCreateInput): Promise<MemberDto> {
    requireAccess(Permissions.admin(actor.role), 'Only a Super Admin can add team members.');
    const name = V.required(req.name, 'Name');
    const username = V.username(req.username);
    const email = V.email(req.email);
    const password = V.required(req.password, 'Password');
    if (password.length < 8) throw badRequest('Password must be at least 8 characters');
    const role = parseRole(V.required(req.access, 'Access role'));

    return this.db.tx(async tx => {
      if ((await tx.query('SELECT 1 FROM members WHERE lower(username) = lower($1)', [username])).rowCount) {
        throw conflict('That username is already taken');
      }
      if ((await tx.query('SELECT 1 FROM members WHERE lower(email) = lower($1)', [email])).rowCount) {
        throw conflict('A team member with this email already exists');
      }
      const id = randomUUID();
      const row = await tx.query<Member>(
        `INSERT INTO members (id, name, username, email, password_hash, role, job_title, department, initials, capacity_hours, availability, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Available', TRUE, now())
         RETURNING ${MEMBER_COLUMNS}`,
        [id, name, username, email, bcrypt.hashSync(password, 12), role, (req.jobTitle ?? '').trim(),
          (req.department ?? '').trim(), initials(name), this.capacity(req.capacityHours)],
      );
      await this.audit.record(tx, actor, `Added team member ${name} as ${ROLE_LABELS[role]}`);
      return this.toDto(row.rows[0], await this.currentWeek(tx));
    });
  }

  async update(actor: Member, id: string, req: MemberUpdateInput): Promise<MemberDto> {
    return this.db.tx(async tx => {
      const found = await tx.query<Member>(`SELECT ${MEMBER_COLUMNS} FROM members WHERE id = $1 FOR UPDATE`, [id]);
      const m = found.rows[0];
      if (!m) throw notFound('Team member not found');

      const profileChange = req.access != null || req.jobTitle != null || req.department != null || req.capacityHours != null;
      if (profileChange) requireAccess(Permissions.admin(actor.role), 'Only a Super Admin can change member details.');

      const sets: string[] = [];
      const params: unknown[] = [];
      const set = (column: string, value: unknown) => {
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      };

      if (req.availability != null) {
        requireAccess(Permissions.manager(actor.role) || Permissions.admin(actor.role), 'Only managers can change availability.');
        set('availability', V.oneOf(req.availability, 'Availability', ['Available', 'Busy'] as const));
      }
      if (req.access != null) {
        const next: Role = parseRole(req.access);
        if (m.role === 'SUPER_ADMIN' && next !== 'SUPER_ADMIN') {
          const admins = await tx.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM members WHERE role = 'SUPER_ADMIN' AND active`);
          if (admins.rows[0].n <= 1) throw conflict('At least one active Super Admin must remain.');
        }
        if (next !== m.role) {
          set('role', next);
          await this.audit.record(tx, actor, `Changed role of ${m.name} to ${ROLE_LABELS[next]}`);
        }
      }
      if (req.jobTitle != null) set('job_title', req.jobTitle.trim());
      if (req.department != null) set('department', req.department.trim());
      if (req.capacityHours != null) set('capacity_hours', this.capacity(req.capacityHours));

      let updated = m;
      if (sets.length) {
        params.push(id);
        const res = await tx.query<Member>(
          `UPDATE members SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${MEMBER_COLUMNS}`, params);
        updated = res.rows[0];
      }
      return this.toDto(updated, await this.currentWeek(tx));
    });
  }

  private capacity(hours: number | null | undefined): number {
    if (hours == null) return 40;
    if (hours < 0 || hours > 168) throw badRequest('Capacity must be between 0 and 168 hours');
    return hours;
  }
}

export interface MemberCreateInput {
  name: string;
  username: string;
  email: string;
  password: string;
  access: string;
  jobTitle?: string;
  department?: string;
  capacityHours?: number | null;
}

export interface MemberUpdateInput {
  access?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  capacityHours?: number | null;
  availability?: string | null;
}
