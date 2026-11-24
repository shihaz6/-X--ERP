package com.alchemyx.erp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
public class Subscription {
    @Id
    private UUID id;
    @Column(name = "client_id")
    private UUID clientId;
    private String plan;
    @Column(name = "monthly_amount")
    private BigDecimal monthlyAmount;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "next_billing_date")
    private LocalDate nextBillingDate;
    /** Active, Paused or Cancelled. */
    private String status;
    @Column(name = "created_at")
    private Instant createdAt;

    public Subscription(UUID id, UUID clientId, String plan, BigDecimal monthlyAmount, LocalDate startDate, Instant createdAt) {
        this.id = id;
        this.clientId = clientId;
        this.plan = plan;
        this.monthlyAmount = monthlyAmount;
        this.startDate = startDate;
        this.nextBillingDate = startDate;
        this.status = "Active";
        this.createdAt = createdAt;
    }
}
