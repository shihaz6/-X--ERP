package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.CapabilitiesDto;
import com.alchemyx.erp.api.Dtos.WorkspaceDto;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.Role;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single read the UI makes after sign-in. Each section is included only when the
 * signed-in role may see it, so restricted data is never sent to the browser.
 */
@Service
public class WorkspaceService {

    private final MemberService members;
    private final ClientService clients;
    private final ProjectService projects;
    private final OrderService orders;
    private final InvoiceService invoices;
    private final LedgerService ledger;
    private final DocumentService documents;
    private final TeamService team;
    private final AuditService audit;
    private final SettingsService settings;
    private final Clock clock;

    public WorkspaceService(MemberService members, ClientService clients, ProjectService projects, OrderService orders,
                            InvoiceService invoices, LedgerService ledger, DocumentService documents, TeamService team,
                            AuditService audit, SettingsService settings, Clock clock) {
        this.members = members;
        this.clients = clients;
        this.projects = projects;
        this.orders = orders;
        this.invoices = invoices;
        this.ledger = ledger;
        this.documents = documents;
        this.team = team;
        this.audit = audit;
        this.settings = settings;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public WorkspaceDto snapshot(Member me) {
        Role r = me.getRole();
        LocalDate today = LocalDate.now(clock);
        LocalDate monday = Parse.monday(today);
        boolean finance = Permissions.finance(r);
        boolean teamView = Permissions.team(r);

        CapabilitiesDto caps = new CapabilitiesDto(
                finance,
                Permissions.editFinance(r),
                Permissions.crm(r),
                Permissions.editCrm(r),
                Permissions.orders(r),
                teamView,
                Permissions.manager(r),
                Permissions.admin(r),
                Permissions.editProjects(r),
                Permissions.editProjects(r) || r == Role.DEVELOPER);

        return new WorkspaceDto(
                members.dto(me),
                caps,
                Fmt.date(today),
                Fmt.date(monday),
                members.list(),
                clients.list(me),
                projects.list(me),
                Permissions.orders(r) ? orders.list(me) : List.of(),
                finance ? invoices.list(me) : List.of(),
                finance ? ledger.list(me) : List.of(),
                documents.list(),
                teamView ? team.leaves() : List.of(),
                teamView ? team.timesheet(me, monday) : List.of(),
                Permissions.admin(r) ? audit.recent(200) : List.of(),
                settings.get());
    }
}
