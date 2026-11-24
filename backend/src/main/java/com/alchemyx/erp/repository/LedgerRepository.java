package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.LedgerEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerRepository extends JpaRepository<LedgerEntry, UUID> {

    List<LedgerEntry> findAllByOrderByTxnDateDescCreatedAtDesc();

    List<LedgerEntry> findByTxnDateBetween(LocalDate from, LocalDate to);

    @Modifying
    @Query("update LedgerEntry l set l.projectId = null where l.projectId = :projectId")
    int detachProject(@Param("projectId") UUID projectId);
}
