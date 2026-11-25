import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { MembersModule } from '../members/members.module';
import { ClientsModule } from '../clients/clients.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrdersModule } from '../orders/orders.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DocumentsModule } from '../documents/documents.module';
import { TeamModule } from '../team/team.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [MembersModule, ClientsModule, ProjectsModule, OrdersModule, InvoicesModule, LedgerModule,
    DocumentsModule, TeamModule, SettingsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
