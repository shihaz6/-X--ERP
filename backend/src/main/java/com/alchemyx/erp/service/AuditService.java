package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.AuditDto;
import com.alchemyx.erp.api.Dtos.PageDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import com.alchemyx.erp.model.AuditEntry;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.repository.AuditRepository;
import com.alchemyx.erp.util.Fmt;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Records who did what. Called by every service that changes business data. */
@Service
public class AuditService {

    private final AuditRepository audit;
    private final Clock clock;

    public AuditService(AuditRepository audit, Clock clock) {
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Member actor, String action) {
        audit.save(new AuditEntry(
                Instant.now(clock),
                actor == null ? null : actor.getId(),
                actor == null ? "System" : actor.getName(),
                action));
    }

    @Transactional(readOnly = true)
    public PageDto<AuditDto> page(int page, int size) {
        Page<AuditEntry> p = audit.findAllByOrderByOccurredAtDescIdDesc(
                PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size))));
        return new PageDto<>(p.map(e -> new AuditDto(Fmt.stamp(e.getOccurredAt(), clock.getZone()), e.getMemberName(), e.getAction())).getContent(),
                p.getTotalElements(), p.getNumber(), p.getSize());
    }

    @Transactional(readOnly = true)
    public List<AuditDto> recent(int limit) {
        return audit.findByOrderByOccurredAtDescIdDesc(Limit.of(limit)).stream()
                .map(e -> new AuditDto(Fmt.stamp(e.getOccurredAt(), clock.getZone()), e.getMemberName(), e.getAction()))
                .toList();
    }
}
