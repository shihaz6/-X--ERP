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

/**
 * JPA entities. Each nested class maps to one table in V1__init_schema.sql.
 * Cross-aggregate references are plain id columns; only the parts that are always
 * loaded and saved together (project tasks/milestones/team, client notes) use mappings.
 */
public final class Entities {

    private Entities() {}

    @Entity
    @Table(name = "members")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Member {
        @Id
        private UUID id;
        private String name;
        private String email;
        @Column(name = "password_hash")
        private String passwordHash;
        @Enumerated(EnumType.STRING)
        private Role role;
        @Column(name = "job_title")
        private String jobTitle;
        private String department;
        private String initials;
        @Column(name = "capacity_hours")
        private int capacityHours;
        /** Stored availability: "Available" or "Busy". "On Leave" is derived from approved leave. */
        private String availability;
        private boolean active;
        @Column(name = "created_at")
        private Instant createdAt;

        public Member(UUID id, String name, String email, String passwordHash, Role role, String jobTitle,
                      String department, String initials, int capacityHours, Instant createdAt) {
            this.id = id;
            this.name = name;
            this.email = email;
            this.passwordHash = passwordHash;
            this.role = role;
            this.jobTitle = jobTitle;
            this.department = department;
            this.initials = initials;
            this.capacityHours = capacityHours;
            this.availability = "Available";
            this.active = true;
            this.createdAt = createdAt;
        }
    }

    @Entity
    @Table(name = "sessions")
    @Getter
    @NoArgsConstructor
    public static class Session {
        @Id
        @Column(name = "token_hash", length = 64)
        private String tokenHash;
        @Column(name = "member_id")
        private UUID memberId;
        @Column(name = "created_at")
        private Instant createdAt;
        @Column(name = "expires_at")
        private Instant expiresAt;

        public Session(String tokenHash, UUID memberId, Instant createdAt, Instant expiresAt) {
            this.tokenHash = tokenHash;
            this.memberId = memberId;
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
        }
    }

    @Entity
    @Table(name = "clients")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Client {
        @Id
        private UUID id;
        private String name;
        private String industry;
        private String contact;
        private String email;
        private String phone;
        private String city;
        private String stage;
        private BigDecimal value;
        @Column(name = "owner_id")
        private UUID ownerId;
        @Column(name = "follow_up")
        private LocalDate followUp;
        private LocalDate since;
        @Column(name = "created_at")
        private Instant createdAt;
        @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
        @JoinColumn(name = "client_id")
        @OrderBy("createdAt DESC")
        private List<ClientNote> notes = new ArrayList<>();

        public Client(UUID id, String name, String industry, String contact, String email, String phone, String city,
                      String stage, BigDecimal value, UUID ownerId, LocalDate since, Instant createdAt) {
            this.id = id;
            this.name = name;
            this.industry = industry;
            this.contact = contact;
            this.email = email;
            this.phone = phone;
            this.city = city;
            this.stage = stage;
            this.value = value;
            this.ownerId = ownerId;
            this.since = since;
            this.createdAt = createdAt;
        }
    }

    @Entity
    @Table(name = "client_notes")
    @Getter
    @NoArgsConstructor
    public static class ClientNote {
        @Id
        private UUID id;
        @Column(name = "note_date")
        private LocalDate noteDate;
        private String type;
        @Column(columnDefinition = "text")
        private String text;
        @Column(name = "created_by")
        private UUID createdBy;
        @Column(name = "created_at")
        private Instant createdAt;

        public ClientNote(UUID id, LocalDate noteDate, String type, String text, UUID createdBy, Instant createdAt) {
            this.id = id;
            this.noteDate = noteDate;
            this.type = type;
            this.text = text;
            this.createdBy = createdBy;
            this.createdAt = createdAt;
        }
    }

    @Entity
    @Table(name = "projects")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Project {
        @Id
        private UUID id;
        private String name;
        @Column(name = "client_id")
        private UUID clientId;
        private String category;
        private String status;
        private String priority;
        private BigDecimal budget;
        @Column(name = "start_date")
        private LocalDate startDate;
        @Column(name = "end_date")
        private LocalDate endDate;
        @Column(name = "created_at")
        private Instant createdAt;

        @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "project_team", joinColumns = @JoinColumn(name = "project_id"))
        @Column(name = "member_id")
        private Set<UUID> team = new HashSet<>();

        @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
        @JoinColumn(name = "project_id")
        @OrderBy("position ASC")
        private List<ProjectTask> tasks = new ArrayList<>();

        @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
        @JoinColumn(name = "project_id")
        @OrderBy("position ASC")
        private List<ProjectMilestone> milestones = new ArrayList<>();

        public Project(UUID id, String name, UUID clientId, String category, String status, String priority,
                       BigDecimal budget, LocalDate startDate, LocalDate endDate, Instant createdAt) {
            this.id = id;
            this.name = name;
            this.clientId = clientId;
            this.category = category;
            this.status = status;
            this.priority = priority;
            this.budget = budget;
            this.startDate = startDate;
            this.endDate = endDate;
            this.createdAt = createdAt;
        }
    }

    @Entity
    @Table(name = "project_tasks")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ProjectTask {
        @Id
        private UUID id;
        private int position;
        private String title;
        private String status;
        @Column(name = "assignee_id")
        private UUID assigneeId;
        @Column(name = "due_date")
        private LocalDate dueDate;

        public ProjectTask(UUID id, int position, String title, String status, UUID assigneeId, LocalDate dueDate) {
            this.id = id;
            this.position = position;
            this.title = title;
            this.status = status;
            this.assigneeId = assigneeId;
            this.dueDate = dueDate;
        }
    }

    @Entity
    @Table(name = "project_milestones")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ProjectMilestone {
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

    @Entity
    @Table(name = "orders")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ServiceOrder {
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

    @Entity
    @Table(name = "invoices")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Invoice {
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

    @Entity
    @Table(name = "transactions")
    @Getter
    @NoArgsConstructor
    public static class LedgerEntry {
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

    @Entity
    @Table(name = "documents")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Document {
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

    @Entity
    @Table(name = "document_versions")
    @Getter
    @NoArgsConstructor
    public static class DocumentVersion {
        @Id
        private UUID id;
        @Column(name = "document_id")
        private UUID documentId;
        private int version;
        @Column(name = "file_name")
        private String fileName;
        @Column(name = "content_type")
        private String contentType;
        @Column(name = "size_bytes")
        private long sizeBytes;
        @Column(name = "uploaded_by")
        private UUID uploadedBy;
        @Column(name = "uploaded_at")
        private Instant uploadedAt;

        public DocumentVersion(UUID id, UUID documentId, int version, String fileName, String contentType,
                               long sizeBytes, UUID uploadedBy, Instant uploadedAt) {
            this.id = id;
            this.documentId = documentId;
            this.version = version;
            this.fileName = fileName;
            this.contentType = contentType;
            this.sizeBytes = sizeBytes;
            this.uploadedBy = uploadedBy;
            this.uploadedAt = uploadedAt;
        }
    }

    @Entity
    @Table(name = "document_blobs")
    @Getter
    @NoArgsConstructor
    public static class DocumentBlob {
        @Id
        @Column(name = "version_id")
        private UUID versionId;
        @Column(nullable = false, columnDefinition = "bytea")
        private byte[] content;

        public DocumentBlob(UUID versionId, byte[] content) {
            this.versionId = versionId;
            this.content = content;
        }
    }

    @Entity
    @Table(name = "leave_requests")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class LeaveRequest {
        @Id
        private UUID id;
        @Column(name = "member_id")
        private UUID memberId;
        @Column(name = "leave_type")
        private String leaveType;
        @Column(name = "from_date")
        private LocalDate fromDate;
        @Column(name = "to_date")
        private LocalDate toDate;
        private String status;
        @Column(name = "decided_by")
        private UUID decidedBy;
        @Column(name = "decided_at")
        private Instant decidedAt;
        @Column(name = "created_at")
        private Instant createdAt;

        public LeaveRequest(UUID id, UUID memberId, String leaveType, LocalDate fromDate, LocalDate toDate, Instant createdAt) {
            this.id = id;
            this.memberId = memberId;
            this.leaveType = leaveType;
            this.fromDate = fromDate;
            this.toDate = toDate;
            this.status = "Pending";
            this.createdAt = createdAt;
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimesheetId implements Serializable {
        private UUID memberId;
        private LocalDate workDate;

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof TimesheetId that)) {
                return false;
            }
            return Objects.equals(memberId, that.memberId) && Objects.equals(workDate, that.workDate);
        }

        @Override
        public int hashCode() {
            return Objects.hash(memberId, workDate);
        }
    }

    @Entity
    @Table(name = "timesheet_entries")
    @IdClass(TimesheetId.class)
    @Getter
    @Setter
    @NoArgsConstructor
    public static class TimesheetEntry {
        @Id
        @Column(name = "member_id")
        private UUID memberId;
        @Id
        @Column(name = "work_date")
        private LocalDate workDate;
        private int hours;

        public TimesheetEntry(UUID memberId, LocalDate workDate, int hours) {
            this.memberId = memberId;
            this.workDate = workDate;
            this.hours = hours;
        }
    }

    @Entity
    @Table(name = "workspace_settings")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class WorkspaceSettings {
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

    @Entity
    @Table(name = "service_categories")
    @Getter
    @Setter
    @NoArgsConstructor
    public static class ServiceCategory {
        @Id
        private String name;
        private int position;

        public ServiceCategory(String name, int position) {
            this.name = name;
            this.position = position;
        }
    }

    @Entity
    @Table(name = "audit_log")
    @Getter
    @NoArgsConstructor
    public static class AuditEntry {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;
        @Column(name = "occurred_at")
        private Instant occurredAt;
        @Column(name = "member_id")
        private UUID memberId;
        @Column(name = "member_name")
        private String memberName;
        private String action;

        public AuditEntry(Instant occurredAt, UUID memberId, String memberName, String action) {
            this.occurredAt = occurredAt;
            this.memberId = memberId;
            this.memberName = memberName;
            this.action = action;
        }
    }
}
