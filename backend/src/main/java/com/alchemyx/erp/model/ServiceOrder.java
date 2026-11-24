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
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
public class ServiceOrder {
    @Id
    private String id;
    private String title;
    @Column(name = "client_id")
    private UUID clientId;
    @Column(name = "project_id")
    private UUID projectId;
    private String service;
    private BigDecimal amount;
    private String status;
    @Column(name = "created_on")
    private LocalDate createdOn;
    @Column(name = "delivery_date")
    private LocalDate deliveryDate;
    @Column(columnDefinition = "text")
    private String spec;
    @Column(name = "created_at")
    private Instant createdAt;

    public ServiceOrder(String id, String title, UUID clientId, UUID projectId, String service, BigDecimal amount,
                        String status, LocalDate createdOn, LocalDate deliveryDate, String spec, Instant createdAt) {
        this.id = id;
        this.title = title;
        this.clientId = clientId;
        this.projectId = projectId;
        this.service = service;
        this.amount = amount;
        this.status = status;
        this.createdOn = createdOn;
        this.deliveryDate = deliveryDate;
        this.spec = spec;
        this.createdAt = createdAt;
    }
}
