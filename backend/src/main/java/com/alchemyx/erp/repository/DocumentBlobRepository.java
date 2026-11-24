package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.DocumentBlob;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentBlobRepository extends JpaRepository<DocumentBlob, UUID> {
}
