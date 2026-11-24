package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.LeaveRequest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveRepository extends JpaRepository<LeaveRequest, UUID> {

    List<LeaveRequest> findAllByOrderByFromDateDesc();

    List<LeaveRequest> findByStatusAndFromDateLessThanEqualAndToDateGreaterThanEqual(String status, LocalDate from, LocalDate to);
}
