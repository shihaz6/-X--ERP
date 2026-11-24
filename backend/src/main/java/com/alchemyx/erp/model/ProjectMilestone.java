package com.alchemyx.erp.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "project_milestones")
@Getter
@Setter
@NoArgsConstructor
public class ProjectMilestone {
    @Id
    private UUID id;
    private int position;
    private String name;
    @Column(name = "due_date")
    private LocalDate dueDate;
    private BigDecimal amount;
    private boolean paid;

    public ProjectMilestone(UUID id, int position, String name, LocalDate dueDate, BigDecimal amount) {
        this.id = id;
        this.position = position;
        this.name = name;
        this.dueDate = dueDate;
        this.amount = amount;
        this.paid = false;
    }
}
