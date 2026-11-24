package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.DocumentVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {

    List<DocumentVersion> findByDocumentIdOrderByVersionDesc(UUID documentId);

    Optional<DocumentVersion> findByDocumentIdAndVersion(UUID documentId, int version);
}
