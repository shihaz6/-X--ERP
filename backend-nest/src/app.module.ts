import { Controller, Get, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { Public } from './auth/public.decorator';
import { DbModule } from './db/db.module';
import { MailModule } from './mail/mail.module';
import { MembersModule } from './members/members.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { LedgerModule } from './ledger/ledger.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TeamModule } from './team/team.module';
import { DocumentsModule } from './documents/documents.module';
import { SettingsModule } from './settings/settings.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Controller('api/health')
class HealthController {
  @Public()
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DbModule,
    MailModule,
    AuditModule,
    AuthModule,
    MembersModule,
    ClientsModule,
    ProjectsModule,
    OrdersModule,
    InvoicesModule,
    LedgerModule,
    SubscriptionsModule,
    TeamModule,
    DocumentsModule,
    SettingsModule,
    AnalyticsModule,
    WorkspaceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
