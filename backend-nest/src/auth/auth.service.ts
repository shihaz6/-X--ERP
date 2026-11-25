import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppConfig, CONFIG } from '../config.provider';
import { Db } from '../db/db.service';
import { unauthorized } from '../common/errors';
import { Member, MEMBER_COLUMNS, memberColumns } from '../common/member';

export const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

/** Opaque random bearer tokens. Only the SHA-256 of a token is stored. */
export const newToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class AuthService {
  constructor(private readonly db: Db, @Inject(CONFIG) private readonly config: AppConfig) {}

  /** Accepts a username or an email address. Same message for unknown account, wrong password and deactivated account. */
  async login(identifier: string, password: string): Promise<{ token: string; expiresAt: Date; member: Member }> {
    const id = (identifier ?? '').trim();
    const found = await this.db.q.query<Member>(
      id.includes('@')
        ? `SELECT ${MEMBER_COLUMNS} FROM members WHERE lower(email) = lower($1) AND active`
        : `SELECT ${MEMBER_COLUMNS} FROM members WHERE lower(username) = lower($1) AND active`,
      [id],
    );
    const member = found.rows[0];
    if (!member || typeof password !== 'string' || !bcrypt.compareSync(password, member.passwordHash)) {
      throw unauthorized('Invalid email or password');
    }
    const token = newToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlMs);
    await this.db.q.query(
      'INSERT INTO sessions (token_hash, member_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      [sha256(token), member.id, now, expiresAt],
    );
    return { token, expiresAt, member };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.db.q.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  }

  /** The active member behind a valid, unexpired token, or null. */
  async resolve(token: string): Promise<Member | null> {
    const r = await this.db.q.query<Member>(
      `SELECT ${memberColumns('m')}
       FROM sessions s JOIN members m ON m.id = s.member_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND m.active`,
      [sha256(token)],
    );
    return r.rows[0] ?? null;
  }
}
