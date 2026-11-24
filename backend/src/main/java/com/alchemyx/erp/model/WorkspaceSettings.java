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
@Table(name = "workspace_settings")
@Getter
@Setter
@NoArgsConstructor
public class WorkspaceSettings {
    @Id
    private Integer id;
    @Column(name = "company_name")
    private String companyName;
    @Column(name = "registration_no")
    private String registrationNo;
    @Column(name = "billing_email")
    private String billingEmail;
    @Column(name = "registered_address")
    private String registeredAddress;
    @Column(name = "default_currency")
    private String defaultCurrency;
    @Column(name = "fiscal_year_start")
    private String fiscalYearStart;
    @Column(name = "opening_cash")
    private BigDecimal openingCash;
    @Column(name = "invoice_prefix")
    private String invoicePrefix;
    @Column(name = "invoice_next_number")
    private int invoiceNextNumber;
    @Column(name = "invoice_template")
    private String invoiceTemplate;
    @Column(name = "payment_terms")
    private String paymentTerms;
    @Column(name = "tax_label")
    private String taxLabel;
    @Column(name = "notify_overdue")
    private boolean notifyOverdue;
    @Column(name = "notify_new_order")
    private boolean notifyNewOrder;
    @Column(name = "notify_leave")
    private boolean notifyLeave;
    @Column(name = "notify_deadline")
    private boolean notifyDeadline;
    @Column(name = "notify_weekly")
    private boolean notifyWeekly;
}
