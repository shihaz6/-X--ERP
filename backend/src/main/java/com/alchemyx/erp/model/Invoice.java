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
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
public class Invoice {
    @Id
    private String id;
    @Column(name = "client_id")
    private UUID clientId;
    @Column(name = "order_id")
    private String orderId;
    private String description;
    private BigDecimal amount;
    @Column(name = "issued_on")
    private LocalDate issuedOn;
    @Column(name = "due_on")
    private LocalDate dueOn;
    /** Stored status: Draft, Sent or Paid. Overdue is derived at read time. */
    private String status;
    @Column(name = "created_at")
    private Instant createdAt;

    public Invoice(String id, UUID clientId, String orderId, String description, BigDecimal amount,
                   LocalDate issuedOn, LocalDate dueOn, String status, Instant createdAt) {
        this.id = id;
        this.clientId = clientId;
        this.orderId = orderId;
        this.description = description;
        this.amount = amount;
        this.issuedOn = issuedOn;
        this.dueOn = dueOn;
        this.status = status;
        this.createdAt = createdAt;
    }
}
