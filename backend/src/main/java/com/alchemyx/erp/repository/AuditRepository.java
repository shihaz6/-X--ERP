package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.AuditEntry;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditRepository extends JpaRepository<AuditEntry, Long> {

    List<AuditEntry> findByOrderByOccurredAtDescIdDesc(Limit limit);
}
