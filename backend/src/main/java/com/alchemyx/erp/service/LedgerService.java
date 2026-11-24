package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.LedgerDto;
import com.alchemyx.erp.api.Dtos.LedgerRequest;
import com.alchemyx.erp.api.Dtos.PageDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.LedgerEntry;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.repository.LedgerRepository;
import com.alchemyx.erp.repository.ProjectRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LedgerService {

    public static final Map<String, List<String>> CATEGORIES = Map.of(
            "Income", List.of("Client Payment", "Subscription", "Consulting Fee", "Other Income"),
            "Expense", List.of("Salaries", "Cloud Infrastructure", "Software", "Rent", "Marketing", "Travel", "Other"));

    private final LedgerRepository ledger;
    private final ProjectRepository projects;
    private final AuditService audit;
    private final Clock clock;

    public LedgerService(LedgerRepository ledger, ProjectRepository projects, AuditService audit, Clock clock) {
        this.ledger = ledger;
        this.projects = projects;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LedgerDto> list(Member viewer) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view transactions.");
        return ledger.findAllByOrderByTxnDateDescCreatedAtDesc().stream().map(LedgerService::toDto).toList();
    }

    public static LedgerDto toDto(LedgerEntry e) {
        return new LedgerDto(
                e.getId().toString(),
                Fmt.date(e.getTxnDate()),
                e.getDescription(),
                e.getCategory(),
                e.getType(),
                e.getAmount(),
                e.getProjectId() == null ? null : e.getProjectId().toString());
    }

    /** Newest entries first, for the dashboard and the workspace snapshot. */
    @Transactional(readOnly = true)
    public List<LedgerDto> recent(Member viewer, int limit) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view transactions.");
        return ledger.findAllByOrderByTxnDateDescCreatedAtDesc(PageRequest.of(0, limit)).getContent()
                .stream().map(LedgerService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public PageDto<LedgerDto> page(Member viewer, int page, int size) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view transactions.");
        Page<LedgerEntry> p = ledger.findAllByOrderByTxnDateDescCreatedAtDesc(
                PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))));
        return new PageDto<>(p.map(LedgerService::toDto).getContent(), p.getTotalElements(), p.getNumber(), p.getSize());
    }

    @Transactional
    public void create(Member actor, LedgerRequest req) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot record transactions.");
        String type = Validation.oneOf(req.type(), "Type", List.of("Income", "Expense"));
        String category = Validation.oneOf(req.category(), "Category", CATEGORIES.get(type));
        UUID projectId = Parse.optionalUuid(req.projectId(), "Project");
        if (projectId != null && !projects.existsById(projectId)) {
            throw ApiException.notFound("Project not found");
        }
        LocalDate date = req.date() == null || req.date().isBlank()
                ? LocalDate.now(clock)
                : Validation.date(req.date(), "Date");
        String description = Validation.required(req.description(), "Description");
        ledger.save(new LedgerEntry(
                UUID.randomUUID(),
                date,
                description,
                category,
                type,
                Validation.positive(req.amount(), "Amount"),
                projectId,
                null,
                Instant.now(clock)));
        audit.record(actor, "Recorded " + type.toLowerCase() + ": " + description);
    }
}
