package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Subscription;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    List<Subscription> findAllByOrderByNextBillingDateAsc();

    boolean existsByClientId(UUID clientId);

    List<Subscription> findByStatusAndNextBillingDateLessThanEqual(String status, LocalDate date);
}
