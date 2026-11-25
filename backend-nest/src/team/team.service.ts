import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { badRequest, conflict, notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { addDays, mondayOf } from '../common/time';
import { AuditService } from '../audit/audit.service';

const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Unpaid'] as const;
const MAX_HOURS_PER_DAY = 16;

export interface TimesheetEntryDto {
  memberId: string;
  date: string;
  hours: number;
}

export interface TimesheetSubmissionDto {
  memberId: string;
  weekStart: string;
  status: string;
}

export interface LeaveDto {
  id: string;
  memberId: string;
  from: string;
  to: string;
  type: string;
  status: string;
}

@Injectable()
export class TeamService {
  constructor(private readonly db: Db, private readonly audit: AuditService) {}

  /** Managers see every timesheet; other members see only their own. Returns Monday to Friday of the week. */
  async timesheet(viewer: Member, weekStartIso: string): Promise<TimesheetEntryDto[]> {
    const monday = mondayOf(V.date(weekStartIso, 'Week start'));
    const rows = await this.db.q.query<{ member_id: string; work_date: string; hours: number }>(
      'SELECT member_id, work_date, hours FROM timesheet_entries WHERE work_date BETWEEN $1 AND $2 ORDER BY work_date',
      [monday, addDays(monday, 4)]);
    return rows.rows
      .filter(t => Permissions.manager(viewer.role) || t.member_id === viewer.id)
      .map(t => ({ memberId: t.member_id, date: t.work_date, hours: Number(t.hours) }));
  }

  async saveTimesheet(actor: Member, req: { weekStart?: string; entries?: { memberId?: string; date?: string; hours?: number }[] }): Promise<void> {
    const monday = mondayOf(V.date(req.weekStart, 'Week start'));
    const friday = addDays(monday, 4);
    if (!Array.isArray(req.entries)) throw badRequest('Entries are required');
    await this.db.tx(async tx => {
      for (const e of req.entries as { memberId?: string; date?: string; hours?: number }[]) {
        const memberId = V.uuid(e.memberId, 'Member');
        const sub = await tx.query<{ status: string }>(
          'SELECT status FROM timesheet_submissions WHERE member_id = $1 AND week_start = $2', [memberId, monday]);
        if (sub.rows[0]?.status === 'Approved') {
          throw conflict('This week has been approved and can no longer be changed');
        }
        if (memberId !== actor.id) {
          requireAccess(Permissions.manager(actor.role), 'You can only log your own hours.');
        }
        if (!(await tx.query('SELECT 1 FROM members WHERE id = $1', [memberId])).rowCount) {
          throw notFound('Team member not found');
        }
        const day = V.date(e.date, 'Date');
        const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
        if (day < monday || day > friday || dow === 0 || dow === 6) {
          throw badRequest('Hours can only be logged for Monday to Friday of the selected week');
        }
        const hours = typeof e.hours === 'number' ? e.hours : NaN;
        if (!Number.isInteger(hours) || hours < 0 || hours > MAX_HOURS_PER_DAY) {
          throw badRequest(`Hours per day must be between 0 and ${MAX_HOURS_PER_DAY}`);
        }
        await tx.query(
          `INSERT INTO timesheet_entries (member_id, work_date, hours) VALUES ($1, $2, $3)
           ON CONFLICT (member_id, work_date) DO UPDATE SET hours = EXCLUDED.hours`,
          [memberId, day, hours]);
      }
    });
  }

  /** Members submit their week; a manager then approves or rejects it. */
  async submitTimesheet(actor: Member, weekStart: string | undefined): Promise<void> {
    const monday = mondayOf(V.date(weekStart, 'Week start'));
    await this.db.tx(async tx => {
      const existing = await tx.query<{ status: string }>(
        'SELECT status FROM timesheet_submissions WHERE member_id = $1 AND week_start = $2 FOR UPDATE', [actor.id, monday]);
      if (existing.rows[0]?.status === 'Approved') throw conflict('This week has already been approved');
      if (existing.rows[0]) {
        await tx.query(
          `UPDATE timesheet_submissions SET status = 'Submitted', submitted_at = now() WHERE member_id = $1 AND week_start = $2`,
          [actor.id, monday]);
      } else {
        await tx.query(
          `INSERT INTO timesheet_submissions (member_id, week_start, status, submitted_at) VALUES ($1, $2, 'Submitted', now())`,
          [actor.id, monday]);
      }
      await this.audit.record(tx, actor, `Submitted weekly timesheet for week of ${monday}`);
    });
  }

  async submissions(weekStartIso: string): Promise<TimesheetSubmissionDto[]> {
    const monday = mondayOf(V.date(weekStartIso, 'Week start'));
    const rows = await this.db.q.query<{ member_id: string; week_start: string; status: string }>(
      'SELECT member_id, week_start, status FROM timesheet_submissions WHERE week_start = $1', [monday]);
    return rows.rows.map(r => ({ memberId: r.member_id, weekStart: r.week_start, status: r.status }));
  }

  async decideWeek(actor: Member, memberId: string, weekStart: string, status: string | undefined): Promise<void> {
    requireAccess(Permissions.manager(actor.role), 'Only managers can approve timesheets.');
    const monday = mondayOf(V.date(weekStart, 'Week start'));
    const id = V.uuid(memberId, 'Member');
    await this.db.tx(async tx => {
      const s = await tx.query<{ status: string }>(
        'SELECT status FROM timesheet_submissions WHERE member_id = $1 AND week_start = $2 FOR UPDATE', [id, monday]);
      if (!s.rows[0]) throw notFound('No submitted timesheet for that week');
      if (s.rows[0].status !== 'Submitted') throw conflict('This timesheet has already been decided');
      const next = V.oneOf(status, 'Status', ['Approved', 'Rejected'] as const);
      await tx.query(
        'UPDATE timesheet_submissions SET status = $1, decided_by = $2, decided_at = now() WHERE member_id = $3 AND week_start = $4',
        [next, actor.id, id, monday]);
      const name = await this.nameOf(tx, id);
      await this.audit.record(tx, actor, `${next} timesheet for ${name} (week of ${monday})`);
    });
  }

  async leaves(): Promise<LeaveDto[]> {
    const rows = await this.db.q.query<{ id: string; member_id: string; from_date: string; to_date: string; leave_type: string; status: string }>(
      'SELECT id, member_id, from_date, to_date, leave_type, status FROM leave_requests ORDER BY from_date DESC');
    return rows.rows.map(l => ({
      id: l.id, memberId: l.member_id, from: l.from_date, to: l.to_date, type: l.leave_type, status: l.status,
    }));
  }

  async requestLeave(actor: Member, req: { type?: string; from?: string; to?: string }): Promise<void> {
    const type = V.oneOf(req.type, 'Leave type', LEAVE_TYPES);
    const from = V.date(req.from, 'From date');
    const to = V.date(req.to, 'To date');
    V.notBefore(to, from, 'End date must be on or after the start date');
    await this.db.tx(async tx => {
      await tx.query(
        `INSERT INTO leave_requests (id, member_id, leave_type, from_date, to_date, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Pending', now())`,
        [randomUUID(), actor.id, type, from, to]);
      await this.audit.record(tx, actor, `Requested ${type.toLowerCase()} leave ${from} to ${to}`);
    });
  }

  async decideLeave(actor: Member, id: string, status: string | undefined): Promise<void> {
    requireAccess(Permissions.manager(actor.role), 'Only managers can approve leave.');
    const leaveId = V.uuid(id, 'Leave request');
    await this.db.tx(async tx => {
      const l = await tx.query<{ status: string; member_id: string }>(
        'SELECT status, member_id FROM leave_requests WHERE id = $1 FOR UPDATE', [leaveId]);
      if (!l.rows[0]) throw notFound('Leave request not found');
      if (l.rows[0].status !== 'Pending') throw conflict('This leave request has already been decided');
      const next = V.oneOf(status, 'Status', ['Approved', 'Rejected'] as const);
      await tx.query(
        'UPDATE leave_requests SET status = $1, decided_by = $2, decided_at = now() WHERE id = $3', [next, actor.id, leaveId]);
      const name = await this.nameOf(tx, l.rows[0].member_id);
      await this.audit.record(tx, actor, `${next} leave for ${name}`);
    });
  }

  private async nameOf(q: Queryable, memberId: string): Promise<string> {
    const r = await q.query<{ name: string }>('SELECT name FROM members WHERE id = $1', [memberId]);
    return r.rows[0]?.name ?? 'team member';
  }
}
