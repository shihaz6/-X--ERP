import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppConfig, CONFIG } from '../config.provider';
import { Db } from '../db/db.service';
import { initials } from '../common/format';

/**
 * On an empty members table, creates the first Super Admin from BOOTSTRAP_ADMIN_* variables.
 * Nothing is created when those variables are missing, so no default credentials ever exist.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger(BootstrapService.name);

  constructor(private readonly db: Db, @Inject(CONFIG) private readonly config: AppConfig) {}

  async onApplicationBootstrap(): Promise<void> {
    const count = await this.db.q.query<{ n: number }>('SELECT count(*)::int AS n FROM members');
    if (count.rows[0].n > 0) return;

    const admin = this.config.bootstrapAdmin;
    if (!admin.username.trim() || !admin.email.trim() || admin.password.length < 8) {
      this.log.warn('No members exist. Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD '
        + '(password min 8 characters) and restart to create the first Super Admin.');
      return;
    }
    const username = admin.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      this.log.error('BOOTSTRAP_ADMIN_USERNAME must be 3-40 characters: letters, digits, dot, underscore or dash.');
      return;
    }
    const name = admin.name.trim() || 'Administrator';
    await this.db.q.query(
      `INSERT INTO members (id, name, username, email, password_hash, role, job_title, department, initials, capacity_hours, availability, active, created_at)
       VALUES ($1, $2, $3, $4, $5, 'SUPER_ADMIN', 'Administrator', 'Leadership', $6, 40, 'Available', TRUE, now())`,
      [randomUUID(), name, username, admin.email.trim().toLowerCase(), bcrypt.hashSync(admin.password, 12), initials(name)],
    );
    this.log.log(`Created bootstrap Super Admin '${username}'`);
  }
}
