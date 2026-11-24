package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.WorkspaceSettings;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface WorkspaceSettingsRepository extends JpaRepository<WorkspaceSettings, Integer> {

    /** Locked read used when issuing invoice numbers, so two invoices never share a number. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from WorkspaceSettings s where s.id = 1")
    Optional<WorkspaceSettings> lockSingleton();
}
