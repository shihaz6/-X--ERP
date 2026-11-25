import { Inject, Injectable } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config.provider';
import { Member } from '../common/member';
import { Permissions } from '../common/permissions';
import { addDays, mondayOf, todayIn } from '../common/time';
import { MembersService } from '../members/members.service';
import { ClientsService } from '../clients/clients.service';
import { ProjectsService } from '../projects/projects.service';
import { OrdersService } from '../orders/orders.service';
import { InvoicesService } from '../invoices/invoices.service';
import { LedgerService } from '../ledger/ledger.service';
import { DocumentsService } from '../documents/documents.service';
import { TeamService } from '../team/team.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';

/**
 * The single read the UI makes after sign-in. Each section is included only when the
 * signed-in role may see it, so restricted data is never sent to the browser.
 */
@Injectable()
export class WorkspaceService {
  constructor(
    private readonly members: MembersService,
    private readonly clients: ClientsService,
    private readonly projects: ProjectsService,
    private readonly orders: OrdersService,
    private readonly invoices: InvoicesService,
    private readonly ledger: LedgerService,
    private readonly documents: DocumentsService,
    private readonly team: TeamService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async snapshot(me: Member) {
    const r = me.role;
    const today = todayIn(this.config.timezone);
    const monday = mondayOf(today);
    const finance = Permissions.finance(r);
    const teamView = Permissions.team(r);

    const capabilities = {
      finance,
      editFinance: Permissions.editFinance(r),
      crm: Permissions.crm(r),
      editCrm: Permissions.editCrm(r),
      orders: Permissions.orders(r),
      team: teamView,
      manager: Permissions.manager(r),
      admin: Permissions.admin(r),
      editProjects: Permissions.editProjects(r),
      moveTasks: Permissions.editProjects(r) || r === 'DEVELOPER',
    };

    return {
      me: await this.members.dto(me),
      capabilities,
      today,
      weekStart: monday,
      members: await this.members.list(),
      clients: await this.clients.list(me),
      projects: await this.projects.list(me),
      orders: Permissions.orders(r) ? await this.orders.list(me) : [],
      invoices: finance ? await this.invoices.list(me) : [],
      transactions: finance ? await this.ledger.recent(me, 50) : [],
      documents: await this.documents.list(),
      leaves: teamView ? await this.team.leaves() : [],
      timesheet: teamView ? await this.team.timesheet(me, monday) : [],
      audit: Permissions.admin(r) ? await this.audit.recent(25) : [],
      settings: await this.settings.get(),
    };
  }
}

export { addDays };
