import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { badRequest, notFound } from '../common/errors';
import { Permissions, requireAccess } from '../common/permissions';
import * as V from '../common/validation';
import { AuditService } from '../audit/audit.service';
import { MembersService } from '../members/members.service';

export const PROJECT_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const TASK_STATUSES = ['Backlog', 'In Progress', 'Review', 'Done'] as const;

export interface TaskDto {
  id: string;
  title: string;
  status: string;
  assignee: string | null;
  due: string;
}

export interface MilestoneDto {
  id: string;
  name: string;
  due: string;
  amount: number;
  paid: boolean;
}

export interface ProjectDto {
  id: string;
  name: string;
  clientId: string | null;
  status: string;
  priority: string;
  budget: number;
  spent: number;
  start: string;
  end: string;
  team: string[];
  category: string;
  tasks: TaskDto[];
  milestones: MilestoneDto[];
}

export interface ProjectInput {
  name?: string | null;
  clientId?: string | null;
  category?: string | null;
  priority?: string | null;
  budget?: number | null;
  start?: string | null;
  end?: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  client_id: string | null;
  category: string;
  status: string;
  priority: string;
  budget: number;
  start_date: string;
  end_date: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly members: MembersService,
  ) {}

  async list(viewer: Member): Promise<ProjectDto[]> {
    const rows = Permissions.seesAllProjects(viewer.role)
      ? await this.db.q.query<ProjectRow>('SELECT * FROM projects ORDER BY start_date DESC')
      : await this.db.q.query<ProjectRow>(
          `SELECT * FROM projects WHERE id IN (SELECT project_id FROM project_team WHERE member_id = $1)
           ORDER BY start_date DESC`, [viewer.id]);
    const ids = rows.rows.map(r => r.id);
    if (!ids.length) return [];

    const [spent, team, tasks, milestones] = await Promise.all([
      this.db.q.query<{ project_id: string; spent: number }>(
        `SELECT project_id, COALESCE(sum(amount), 0) AS spent FROM transactions
         WHERE type = 'Expense' AND project_id IS NOT NULL GROUP BY project_id`),
      this.db.q.query<{ project_id: string; member_id: string }>(
        'SELECT project_id, member_id FROM project_team WHERE project_id = ANY($1::uuid[])', [ids]),
      this.db.q.query<{ id: string; project_id: string; position: number; title: string; status: string; assignee_id: string | null; due_date: string }>(
        `SELECT id, project_id, position, title, status, assignee_id, due_date FROM project_tasks
         WHERE project_id = ANY($1::uuid[]) ORDER BY position`, [ids]),
      this.db.q.query<{ id: string; project_id: string; position: number; name: string; due_date: string; amount: number; paid: boolean }>(
        `SELECT id, project_id, position, name, due_date, amount, paid FROM project_milestones
         WHERE project_id = ANY($1::uuid[]) ORDER BY position`, [ids]),
    ]);

    const spentBy = new Map(spent.rows.map(r => [r.project_id, Number(r.spent)]));
    const teamBy = group(team.rows, r => r.project_id, r => r.member_id);
    const tasksBy = group(tasks.rows, r => r.project_id, r => ({
      id: r.id, title: r.title, status: r.status, assignee: r.assignee_id, due: r.due_date,
    } as TaskDto));
    const milestonesBy = group(milestones.rows, r => r.project_id, r => ({
      id: r.id, name: r.name, due: r.due_date, amount: Number(r.amount), paid: r.paid,
    } as MilestoneDto));

    return rows.rows.map(p => ({
      id: p.id,
      name: p.name,
      clientId: p.client_id,
      status: p.status,
      priority: p.priority,
      budget: Number(p.budget),
      spent: spentBy.get(p.id) ?? 0,
      start: p.start_date,
      end: p.end_date,
      team: (teamBy.get(p.id) ?? []).sort(),
      category: p.category,
      tasks: tasksBy.get(p.id) ?? [],
      milestones: milestonesBy.get(p.id) ?? [],
    }));
  }

  async create(actor: Member, req: ProjectInput): Promise<void> {
    requireAccess(Permissions.editProjects(actor.role), 'Your role cannot create projects.');
    // The client is optional. When one is given it must exist.
    const clientId = V.optionalUuid(req.clientId, 'Client');
    const start = V.date(req.start, 'Start date');
    const end = V.date(req.end, 'End date');
    V.notBefore(end, start, 'End date must be on or after the start date');
    const name = V.required(req.name, 'Project name');
    const category = V.required(req.category, 'Category');
    const priority = req.priority == null ? 'Medium' : V.oneOf(req.priority, 'Priority', PRIORITIES);
    const budget = V.positive(req.budget, 'Budget');

    await this.db.tx(async tx => {
      if (clientId && !(await tx.query('SELECT 1 FROM clients WHERE id = $1', [clientId])).rowCount) {
        throw notFound('Client not found');
      }
      const id = randomUUID();
      await tx.query(
        `INSERT INTO projects (id, name, client_id, category, status, priority, budget, start_date, end_date, created_at)
         VALUES ($1, $2, $3, $4, 'Planning', $5, $6, $7, $8, now())`,
        [id, name, clientId, category, priority, budget, start, end]);
      await tx.query('INSERT INTO project_team (project_id, member_id) VALUES ($1, $2)', [id, actor.id]);
      await this.audit.record(tx, actor, `Created project ${name}`);
    });
  }

  async setStatus(actor: Member, id: string, status: string | undefined): Promise<void> {
    requireAccess(Permissions.editProjects(actor.role), 'Your role cannot change project status.');
    await this.db.tx(async tx => {
      const p = await this.find(tx, id, true);
      const next = V.oneOf(status, 'Status', PROJECT_STATUSES);
      await tx.query('UPDATE projects SET status = $1 WHERE id = $2', [next, id]);
      await this.audit.record(tx, actor, `Set ${p.name} status to ${next}`);
    });
  }

  async delete(actor: Member, id: string): Promise<void> {
    requireAccess(Permissions.editProjects(actor.role), 'Your role cannot delete projects.');
    await this.db.tx(async tx => {
      const p = await this.find(tx, id, true);
      await tx.query('UPDATE orders SET project_id = NULL WHERE project_id = $1', [id]);
      await tx.query('UPDATE transactions SET project_id = NULL WHERE project_id = $1', [id]);
      await tx.query('UPDATE documents SET project_id = NULL WHERE project_id = $1', [id]);
      await tx.query('DELETE FROM projects WHERE id = $1', [id]);
      await this.audit.record(tx, actor, `Deleted project ${p.name}`);
    });
  }

  async assignMember(actor: Member, id: string, memberId: string | undefined): Promise<void> {
    requireAccess(Permissions.editProjects(actor.role), 'Your role cannot assign team members.');
    await this.db.tx(async tx => {
      const p = await this.find(tx, id, true);
      const memberUuid = V.uuid(memberId, 'Team member');
      const m = await tx.query<{ name: string }>('SELECT name FROM members WHERE id = $1', [memberUuid]);
      if (!m.rows[0]) throw notFound('Team member not found');
      const added = await tx.query(
        'INSERT INTO project_team (project_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, memberUuid]);
      if (added.rowCount) {
        await this.audit.record(tx, actor, `Assigned ${m.rows[0].name} to ${p.name}`);
      }
    });
  }

  async addTask(actor: Member, id: string, req: { title?: string; assigneeId?: string | null; due?: string }): Promise<void> {
    await this.db.tx(async tx => {
      await this.find(tx, id, true);
      await this.requireTaskAccess(tx, actor, id);
      const title = V.required(req.title, 'Task title');
      const due = V.date(req.due, 'Due date');
      const assignee = req.assigneeId == null || !req.assigneeId.trim() ? null : V.uuid(req.assigneeId, 'Assignee');
      if (assignee && !(await this.isOnTeam(tx, id, assignee))) {
        throw badRequest('Assignee must be on the project team');
      }
      await tx.query(
        `INSERT INTO project_tasks (id, project_id, position, title, status, assignee_id, due_date)
         VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM project_tasks WHERE project_id = $2), $3, 'Backlog', $4, $5)`,
        [randomUUID(), id, title, assignee, due]);
    });
  }

  async moveTask(actor: Member, projectId: string, taskId: string, status: string | undefined): Promise<void> {
    await this.db.tx(async tx => {
      const p = await this.find(tx, projectId, true);
      await this.requireTaskAccess(tx, actor, projectId);
      const next = V.oneOf(status, 'Status', TASK_STATUSES);
      const res = await tx.query('UPDATE project_tasks SET status = $1 WHERE id = $2 AND project_id = $3', [next, taskId, projectId]);
      if (!res.rowCount) throw notFound('Task not found');
      await this.audit.record(tx, actor, `Moved task to ${next} in ${p.name}`);
    });
  }

  async setMilestonePaid(actor: Member, projectId: string, milestoneId: string, paid: boolean): Promise<void> {
    requireAccess(Permissions.editFinance(actor.role), 'Only finance roles can mark milestones as paid.');
    await this.db.tx(async tx => {
      await this.find(tx, projectId, true);
      const m = await tx.query<{ name: string; paid: boolean }>(
        'SELECT name, paid FROM project_milestones WHERE id = $1 AND project_id = $2 FOR UPDATE', [milestoneId, projectId]);
      if (!m.rows[0]) throw notFound('Milestone not found');
      if (paid && !m.rows[0].paid) {
        await tx.query('UPDATE project_milestones SET paid = TRUE WHERE id = $1', [milestoneId]);
        await this.audit.record(tx, actor, `Milestone "${m.rows[0].name}" paid`);
      }
    });
  }

  /** Developers may move and add tasks on projects they are assigned to; managers on any project. */
  private async requireTaskAccess(q: Queryable, actor: Member, projectId: string): Promise<void> {
    const allowed = Permissions.editProjects(actor.role)
      || (actor.role === 'DEVELOPER' && (await this.isOnTeam(q, projectId, actor.id)));
    requireAccess(allowed, 'You can only update tasks on projects you are assigned to.');
  }

  private async isOnTeam(q: Queryable, projectId: string, memberId: string): Promise<boolean> {
    return (await q.query('SELECT 1 FROM project_team WHERE project_id = $1 AND member_id = $2', [projectId, memberId])).rowCount > 0;
  }

  async find(q: Queryable, id: string, lock: boolean): Promise<{ id: string; name: string }> {
    const r = await q.query<{ id: string; name: string }>(
      `SELECT id, name FROM projects WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!r.rows[0]) throw notFound('Project not found');
    return r.rows[0];
  }
}

function group<T, K, V2>(rows: T[], key: (r: T) => K, value: (r: T) => V2): Map<K, V2[]> {
  const map = new Map<K, V2[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k) ?? [];
    list.push(value(r));
    map.set(k, list);
  }
  return map;
}
