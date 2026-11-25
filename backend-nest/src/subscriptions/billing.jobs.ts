import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig, CONFIG } from '../config.provider';
import { SubscriptionsService } from './subscriptions.service';
import { InvoiceDeliveryService } from '../invoices/invoice-delivery.service';

/**
 * Daily jobs that run without a signed-in user: billing at 06:00 and overdue reminders at 07:00
 * in the workspace timezone. Schedules come from BILLING_CRON and OVERDUE_CRON (six fields, seconds first).
 * Each job is safe to repeat: a subscription's billing date only moves forward when it is billed.
 */
@Injectable()
export class BillingJobs implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BillingJobs.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly delivery: InvoiceDeliveryService,
    private readonly registry: SchedulerRegistry,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    const zone = this.config.timezone;
    this.registry.addCronJob('billing-due-subscriptions',
      new CronJob(this.config.billingCron, () => void this.billDue(), null, true, zone));
    this.registry.addCronJob('overdue-reminders',
      new CronJob(this.config.overdueCron, () => void this.overdue(), null, true, zone));
  }

  onModuleDestroy(): void {
    for (const name of ['billing-due-subscriptions', 'overdue-reminders']) {
      if (this.registry.doesExist('cron', name)) this.registry.deleteCronJob(name);
    }
  }

  async billDue(): Promise<void> {
    try {
      const drafted = await this.subscriptions.billDueAsSystem();
      if (drafted > 0) this.log.log(`Daily billing drafted ${drafted} invoice(s)`);
    } catch (err) {
      this.log.error(`Daily billing failed: ${(err as Error).message}`);
    }
  }

  async overdue(): Promise<void> {
    try {
      await this.delivery.sendOverdueReminders();
    } catch (err) {
      this.log.error(`Overdue reminders failed: ${(err as Error).message}`);
    }
  }
}
