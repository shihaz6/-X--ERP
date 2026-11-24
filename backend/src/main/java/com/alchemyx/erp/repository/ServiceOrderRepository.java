package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.ServiceOrder;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServiceOrderRepository extends JpaRepository<ServiceOrder, String> {

    List<ServiceOrder> findAllByOrderByIdDesc();

    boolean existsByClientId(UUID clientId);

    @Modifying
    @Query("update ServiceOrder o set o.projectId = null where o.projectId = :projectId")
    int detachProject(@Param("projectId") UUID projectId);
}
