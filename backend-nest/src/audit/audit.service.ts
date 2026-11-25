import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config.provider';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { stampIn } from '../common/time';

export interface AuditDto {
  at: string | null;
  who: string;
  what: string;
}

export interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** Append-only record of who changed what. Services call record() inside their own transaction. */
@Injectable()
export class AuditService {
  constructor(private readonly db: Db, @Inject(CONFIG) private readonly config: AppConfig) {}

  async record(q: Queryable, actor: Member | null, action: string): Promise<void> {
    await q.query(
      'INSERT INTO audit_log (occurred_at, member_id, member_name, action) VALUES (now(), $1, $2, $3)',
      [actor?.id ?? null, actor?.name ?? 'System', action],
    );
  }

  async page(page: number, size: number): Promise<PageDto<AuditDto>> {
    const p = Math.max(0, page);
    const s = Math.min(100, Math.max(1, size));
    const total = await this.db.q.query<{ n: number }>('SELECT count(*)::int AS n FROM audit_log');
    const rows = await this.db.q.query<{ occurred_at: Date; member_name: string; action: string }>(
      'SELECT occurred_at, member_name, action FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT $1 OFFSET $2',
      [s, p * s],
    );
    return {
      items: rows.rows.map(r => this.toDto(r)),
      total: total.rows[0].n,
      page: p,
      size: s,
    };
  }

  async recent(limit: number): Promise<AuditDto[]> {
    const rows = await this.db.q.query<{ occurred_at: Date; member_name: string; action: string }>(
      'SELECT occurred_at, member_name, action FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT $1',
      [limit],
    );
    return rows.rows.map(r => this.toDto(r));
  }

  private toDto(r: { occurred_at: Date; member_name: string; action: string }): AuditDto {
    return { at: stampIn(r.occurred_at, this.config.timezone), who: r.member_name, what: r.action };
  }
}
