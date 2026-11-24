package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.TimesheetEntry;
import com.alchemyx.erp.model.Entities.TimesheetId;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimesheetRepository extends JpaRepository<TimesheetEntry, TimesheetId> {

    List<TimesheetEntry> findByWorkDateBetween(LocalDate from, LocalDate to);
}
