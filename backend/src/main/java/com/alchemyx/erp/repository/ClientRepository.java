package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Client;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    List<Client> findAllByOrderByNameAsc();
}
