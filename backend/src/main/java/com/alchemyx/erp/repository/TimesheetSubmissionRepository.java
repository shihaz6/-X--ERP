package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.TimesheetSubmission;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimesheetSubmissionRepository extends JpaRepository<TimesheetSubmission, TimesheetSubmission.Key> {

    List<TimesheetSubmission> findByWeekStart(LocalDate weekStart);
}
