import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { BillingJobs } from './billing.jobs';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, BillingJobs],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
