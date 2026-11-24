package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.Invoice;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {

    List<Invoice> findAllByOrderByIssuedOnDescIdDesc();
}
