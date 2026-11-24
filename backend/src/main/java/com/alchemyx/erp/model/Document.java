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

@Entity(name = "ErpDocument")
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
public class Document {
    @Id
    private UUID id;
    private String name;
    private String category;
    @Column(name = "client_id")
    private UUID clientId;
    @Column(name = "project_id")
    private UUID projectId;
    private String status;
    @Column(name = "current_version")
    private int currentVersion;
    @Column(name = "updated_on")
    private LocalDate updatedOn;
    @Column(name = "created_at")
    private Instant createdAt;

    public Document(UUID id, String name, String category, UUID clientId, UUID projectId, LocalDate updatedOn,
                    Instant createdAt) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.clientId = clientId;
        this.projectId = projectId;
        this.status = "Draft";
        this.currentVersion = 1;
        this.updatedOn = updatedOn;
        this.createdAt = createdAt;
    }
}
