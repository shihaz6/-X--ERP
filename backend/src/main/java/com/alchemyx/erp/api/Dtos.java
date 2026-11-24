package com.alchemyx.erp.api;

import java.math.BigDecimal;
import java.util.List;

/** Request and response shapes. Dates are ISO strings (YYYY-MM-DD), timestamps are "yyyy-MM-dd HH:mm". */
public final class Dtos {

    private Dtos() {}

    // ---- auth ----
    /** username may be the member's username or their email address. */
    public record LoginRequest(String username, String password) {}
    public record LoginResponse(String token, String expiresAt, MemberDto member) {}

    // ---- members ----
    /** role is the job title shown on cards; access is the system role label. */
    public record MemberDto(String id, String name, String email, String role, String dept, String access,
                            int hours, int capacity, String status, String initials) {}
    public record MemberCreateRequest(String name, String username, String email, String password, String access,
                                      String jobTitle, String department, Integer capacityHours) {}
    public record MemberUpdateRequest(String access, String jobTitle, String department, Integer capacityHours,
                                      String availability) {}

    // ---- clients ----
    public record ClientNoteDto(String date, String type, String text) {}
    public record ClientDto(String id, String name, String industry, String contact, String email, String phone,
                            String city, String stage, BigDecimal value, String owner, String followUp, String since,
                            List<ClientNoteDto> notes) {}
    public record ClientRequest(String name, String industry, String contact, String email, String phone,
                                String city, String stage, BigDecimal value, String followUp) {}
    public record ClientNoteRequest(String type, String text) {}

    // ---- projects ----
    public record TaskDto(String id, String title, String status, String assignee, String due) {}
    public record MilestoneDto(String id, String name, String due, BigDecimal amount, boolean paid) {}
    public record ProjectDto(String id, String name, String clientId, String status, String priority,
                             BigDecimal budget, BigDecimal spent, String start, String end, List<String> team,
                             String category, List<TaskDto> tasks, List<MilestoneDto> milestones) {}
    public record ProjectRequest(String name, String clientId, String category, String priority,
                                 BigDecimal budget, String start, String end, String status) {}
    public record TeamAssignRequest(String memberId) {}
    public record TaskRequest(String title, String assigneeId, String due) {}
    public record TaskStatusRequest(String status) {}
    public record MilestonePaidRequest(boolean paid) {}

    // ---- orders & invoices ----
    public record OrderDto(String id, String title, String clientId, String projectId, String service,
                           BigDecimal amount, String status, String created, String delivery, String spec) {}
    public record OrderRequest(String title, String clientId, String projectId, String service,
                               BigDecimal amount, String delivery, String spec) {}
    public record StatusRequest(String status) {}
    public record InvoiceDto(String id, String clientId, String orderId, BigDecimal amount, String issued,
                             String due, String status, String description) {}
    /** Creation from the invoice form. status is Draft or Sent. */
    public record InvoiceRequest(String clientId, String orderId, String description, BigDecimal amount,
                                 String due, String status) {}

    // ---- ledger ----
    public record LedgerDto(String id, String date, String desc, String category, String type, BigDecimal amount,
                            String projectId) {}
    public record LedgerRequest(String type, String description, String category, BigDecimal amount, String date,
                                String projectId) {}

    // ---- documents ----
    public record DocumentVersionDto(int version, String fileName, long sizeBytes, String uploadedAt,
                                     String uploadedBy) {}
    public record DocumentDto(String id, String name, String category, String clientId, String projectId,
                              String status, int version, String updated, String size,
                              List<DocumentVersionDto> versions) {}
    public record DocumentStatusRequest(String status) {}

    // ---- team ----
    public record LeaveDto(String id, String memberId, String from, String to, String type, String status) {}
    public record LeaveRequest(String type, String from, String to) {}
    public record LeaveDecisionRequest(String status) {}
    public record TimesheetEntryDto(String memberId, String date, int hours) {}
    public record TimesheetRequest(String weekStart, List<TimesheetEntryDto> entries) {}
    public record TimesheetSubmitRequest(String weekStart) {}

    // ---- settings & audit ----
    public record AuditDto(String at, String who, String what) {}
    public record CompanyDto(String name, String registrationNo, String billingEmail, String address) {}
    public record InvoicingDto(String prefix, int nextNumber, String template, String paymentTerms, String taxLabel) {}
    public record NotificationsDto(boolean overdue, boolean newOrder, boolean leave, boolean deadline, boolean weekly) {}
    public record SettingsDto(CompanyDto company, String currency, String fiscalYearStart, BigDecimal openingCash,
                              InvoicingDto invoicing, NotificationsDto notifications, List<String> services) {}
    /** Partial update: null fields are left unchanged. */
    public record SettingsRequest(String companyName, String registrationNo, String billingEmail,
                                  String registeredAddress, String currency, String fiscalYearStart,
                                  BigDecimal openingCash, String invoicePrefix, Integer invoiceNextNumber,
                                  String invoiceTemplate, String paymentTerms, String taxLabel,
                                  Boolean notifyOverdue, Boolean notifyNewOrder, Boolean notifyLeave,
                                  Boolean notifyDeadline, Boolean notifyWeekly) {}
    public record ServicesRequest(List<String> services) {}

    // ---- workspace & analytics ----
    public record CapabilitiesDto(boolean finance, boolean editFinance, boolean crm, boolean editCrm,
                                  boolean orders, boolean team, boolean manager, boolean admin,
                                  boolean editProjects, boolean moveTasks) {}
    public record WorkspaceDto(MemberDto me, CapabilitiesDto capabilities, String today, String weekStart,
                               List<MemberDto> members, List<ClientDto> clients, List<ProjectDto> projects,
                               List<OrderDto> orders, List<InvoiceDto> invoices, List<LedgerDto> transactions,
                               List<DocumentDto> documents, List<LeaveDto> leaves,
                               List<TimesheetEntryDto> timesheet, List<AuditDto> audit, SettingsDto settings) {}
    public record MonthPointDto(String month, String label, BigDecimal revenue, BigDecimal expenses, int newClients) {}
    public record FiscalYearDto(String label, BigDecimal revenue, BigDecimal expenses) {}
    public record CashPointDto(String label, BigDecimal balance) {}
    public record FinanceAnalyticsDto(List<MonthPointDto> months, List<FiscalYearDto> fiscalYears,
                                      List<CashPointDto> cash, BigDecimal cashPosition, BigDecimal outstanding,
                                      BigDecimal overdue, BigDecimal recurringLast30Days) {}
}
