import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { loadConfig } from '../config';
import { SubscriptionsService } from './subscriptions.service';
import { InvoiceDeliveryService } from '../invoices/invoice-delivery.service';

const config = loadConfig();

/**
 * Daily jobs that run without a signed-in user: billing at 06:00 and overdue reminders at 07:00
 * in the workspace timezone. Schedules come from BILLING_CRON and OVERDUE_CRON (six fields, seconds first).
 * Each job is safe to repeat: a subscription's billing date only moves forward when it is billed.
 */
@Injectable()
export class BillingJobs {
  private readonly log = new Logger(BillingJobs.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly delivery: InvoiceDeliveryService,
  ) {}

  @Cron(config.billingCron, { name: 'billing-due-subscriptions', timeZone: config.timezone })
  async billDue(): Promise<void> {
    try {
      const drafted = await this.subscriptions.billDueAsSystem();
      if (drafted > 0) this.log.log(`Daily billing drafted ${drafted} invoice(s)`);
    } catch (err) {
      this.log.error(`Daily billing failed: ${(err as Error).message}`);
    }
  }

  @Cron(config.overdueCron, { name: 'overdue-reminders', timeZone: config.timezone })
  async overdue(): Promise<void> {
    try {
      await this.delivery.sendOverdueReminders();
    } catch (err) {
      this.log.error(`Overdue reminders failed: ${(err as Error).message}`);
    }
  }
}
