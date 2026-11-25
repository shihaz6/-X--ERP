import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppConfig, CONFIG } from '../config.provider';
import { Db } from '../db/db.service';
import { Member, MEMBER_COLUMNS } from '../common/member';
import { badRequest } from '../common/errors';
import { MailService } from '../mail/mail.service';
import { newToken, sha256 } from './auth.service';

const RESET_TTL_MS = 60 * 60 * 1000;
const INVALID_LINK = 'This reset link is invalid or has expired';

/**
 * Forgot-password and reset. The reply to a request never says whether the email exists.
 * Links are single use and expire after one hour. Resetting signs the member out everywhere.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly db: Db,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async request(address: string | undefined): Promise<void> {
    if (!address || !address.trim()) return;
    const found = await this.db.q.query<Member>(
      `SELECT ${MEMBER_COLUMNS} FROM members WHERE lower(email) = lower($1) AND active`, [address.trim()]);
    const member = found.rows[0];
    if (!member) return;

    const token = newToken();
    const now = new Date();
    await this.db.tx(async tx => {
      await tx.query('UPDATE password_resets SET used = TRUE WHERE member_id = $1 AND used = FALSE', [member.id]);
      await tx.query(
        'INSERT INTO password_resets (token_hash, member_id, expires_at, used, created_at) VALUES ($1, $2, $3, FALSE, $4)',
        [sha256(token), member.id, new Date(now.getTime() + RESET_TTL_MS), now],
      );
    });
    const link = `${this.config.frontendUrl}/?reset=${token}`;
    await this.mail.send(
      member.email,
      'Reset your AlchemyX password',
      `Hello ${member.name},\n\nUse this link to choose a new password. It works once and expires in one hour:\n\n${link}\n\n` +
        'If you did not ask for this, you can ignore this email.',
    );
  }

  async reset(token: string | undefined, password: string | undefined): Promise<void> {
    if (!token || !token.trim()) throw badRequest(INVALID_LINK);
    await this.db.tx(async tx => {
      const r = await tx.query<{ member_id: string }>(
        'SELECT member_id FROM password_resets WHERE token_hash = $1 AND NOT used AND expires_at > now() FOR UPDATE',
        [sha256(token)],
      );
      if (!r.rows[0]) throw badRequest(INVALID_LINK);
      if (!password || password.length < 8) throw badRequest('Password must be at least 8 characters');
      const memberId = r.rows[0].member_id;
      const updated = await tx.query('UPDATE members SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(password, 12), memberId]);
      if (!updated.rowCount) throw badRequest(INVALID_LINK);
      await tx.query('UPDATE password_resets SET used = TRUE WHERE token_hash = $1', [sha256(token)]);
      await tx.query('DELETE FROM sessions WHERE member_id = $1', [memberId]);
    });
  }
}
