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
@Table(name = "transactions")
@Getter
@NoArgsConstructor
public class LedgerEntry {
    @Id
    private UUID id;
    @Column(name = "txn_date")
    private LocalDate txnDate;
    private String description;
    private String category;
    private String type;
    private BigDecimal amount;
    @Column(name = "project_id")
    private UUID projectId;
    @Column(name = "invoice_id")
    private String invoiceId;
    @Column(name = "created_at")
    private Instant createdAt;

    public LedgerEntry(UUID id, LocalDate txnDate, String description, String category, String type,
                       BigDecimal amount, UUID projectId, String invoiceId, Instant createdAt) {
        this.id = id;
        this.txnDate = txnDate;
        this.description = description;
        this.category = category;
        this.type = type;
        this.amount = amount;
        this.projectId = projectId;
        this.invoiceId = invoiceId;
        this.createdAt = createdAt;
    }

    public void detachFromProject() {
        this.projectId = null;
    }
}
