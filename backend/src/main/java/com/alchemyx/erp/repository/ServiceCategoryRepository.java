package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.ServiceCategory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceCategoryRepository extends JpaRepository<ServiceCategory, String> {

    List<ServiceCategory> findAllByOrderByPositionAscNameAsc();
}
