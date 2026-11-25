import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/public.decorator';
import { unauthorized } from '../common/errors';
import { AppConfig, CONFIG } from '../config.provider';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InvoiceDeliveryService } from '../invoices/invoice-delivery.service';

/**
 * Scheduled jobs for hosts where the process does not stay running (Vercel Cron). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`. Each job is safe to repeat.
 */
@Controller('api/jobs')
export class JobsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly delivery: InvoiceDeliveryService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('billing')
  async billing(@Headers('authorization') auth?: string): Promise<{ invoices: number }> {
    this.requireCron(auth);
    return { invoices: await this.subscriptions.billDueAsSystem() };
  }

  @Public()
  @Get('overdue')
  async overdue(@Headers('authorization') auth?: string): Promise<{ ok: boolean }> {
    this.requireCron(auth);
    await this.delivery.sendOverdueReminders();
    return { ok: true };
  }

  private requireCron(auth: string | undefined): void {
    const secret = this.config.cronSecret;
    if (!secret) throw unauthorized('Scheduled jobs are not configured (CRON_SECRET is not set).');
    const expected = Buffer.from(`Bearer ${secret}`);
    const given = Buffer.from(auth ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw unauthorized('Not allowed');
    }
  }
}
