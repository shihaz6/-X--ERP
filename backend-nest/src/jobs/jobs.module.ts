import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [SubscriptionsModule, InvoicesModule],
  controllers: [JobsController],
})
export class JobsModule {}
