package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Document;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findAllByOrderByUpdatedOnDescNameAsc();

    boolean existsByClientId(UUID clientId);

    @Modifying
    @Query("update ErpDocument d set d.projectId = null where d.projectId = :projectId")
    int detachProject(@Param("projectId") UUID projectId);
}
