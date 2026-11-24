package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Entities.Project;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    List<Project> findAllByOrderByStartDateDesc();

    List<Project> findByTeamContainingOrderByStartDateDesc(UUID memberId);
}
