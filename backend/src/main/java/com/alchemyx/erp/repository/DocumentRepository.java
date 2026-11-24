package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.Document;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findAllByOrderByUpdatedOnDescNameAsc();

    @Modifying
    @Query("update Document d set d.projectId = null where d.projectId = :projectId")
    int detachProject(@Param("projectId") UUID projectId);
}
