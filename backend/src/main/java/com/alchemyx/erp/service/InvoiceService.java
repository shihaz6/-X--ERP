package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.InvoiceDto;
import com.alchemyx.erp.api.Dtos.InvoiceRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Client;
import com.alchemyx.erp.model.Invoice;
import com.alchemyx.erp.model.LedgerEntry;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.ServiceOrder;
import com.alchemyx.erp.model.WorkspaceSettings;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.InvoiceRepository;
import com.alchemyx.erp.repository.LedgerRepository;
import com.alchemyx.erp.repository.ServiceOrderRepository;
import com.alchemyx.erp.repository.WorkspaceSettingsRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceService {

    private static final List<String> EDITABLE_STATUSES = List.of("Draft", "Sent");
    private static final int DEFAULT_TERM_DAYS = 30;

    private final InvoiceRepository invoices;
    private final ClientRepository clients;
    private final ServiceOrderRepository orders;
    private final LedgerRepository ledger;
    private final WorkspaceSettingsRepository settings;
    private final AuditService audit;
    private final Clock clock;

    public InvoiceService(InvoiceRepository invoices, ClientRepository clients, ServiceOrderRepository orders,
                          LedgerRepository ledger, WorkspaceSettingsRepository settings, AuditService audit, Clock clock) {
        this.invoices = invoices;
        this.clients = clients;
        this.orders = orders;
        this.ledger = ledger;
        this.settings = settings;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<InvoiceDto> list(Member viewer) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view invoices.");
        LocalDate today = LocalDate.now(clock);
        return invoices.findAllByOrderByIssuedOnDescIdDesc().stream().map(i -> toDto(i, today)).toList();
    }

    /** "Overdue" is not stored. A sent invoice past its due date is reported as overdue. */
    public static String effectiveStatus(Invoice i, LocalDate today) {
        if ("Sent".equals(i.getStatus()) && i.getDueOn().isBefore(today)) {
            return "Overdue";
        }
        return i.getStatus();
    }

    public InvoiceDto toDto(Invoice i, LocalDate today) {
        return new InvoiceDto(
                i.getId(),
                i.getClientId().toString(),
                i.getOrderId(),
                i.getAmount(),
                Fmt.date(i.getIssuedOn()),
                Fmt.date(i.getDueOn()),
                effectiveStatus(i, today),
                i.getDescription());
    }

    @Transactional
    public void create(Member actor, InvoiceRequest req) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot issue invoices.");
        UUID clientId = Parse.uuid(req.clientId(), "Client");
        if (!clients.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        String orderId = req.orderId() == null || req.orderId().isBlank() ? null : req.orderId().trim();
        if (orderId != null) {
            ServiceOrder o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found"));
            if (!o.getClientId().equals(clientId)) {
                throw ApiException.badRequest("The order belongs to a different client");
            }
        }
        LocalDate issued = LocalDate.now(clock);
        LocalDate due = Validation.date(req.due(), "Due date");
        Validation.notBefore(due, issued, "Due date cannot be before the issue date");
        String status = req.status() == null ? "Draft" : Validation.oneOf(req.status(), "Status", List.of("Draft", "Sent"));

        Invoice inv = new Invoice(
                nextInvoiceNumber(issued),
                clientId,
                orderId,
                Validation.required(req.description(), "Line item description"),
                Validation.positive(req.amount(), "Amount"),
                issued,
                due,
                status,
                Instant.now(clock));
        invoices.save(inv);
        audit.record(actor, "Created invoice " + inv.getId());
    }

    /** Draft invoice for an order, due in 30 days, with the order value as the amount. */
    @Transactional
    public void createFromOrder(Member actor, String orderId) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot issue invoices.");
        ServiceOrder o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found"));
        if ("Cancelled".equals(o.getStatus())) {
            throw ApiException.conflict("A cancelled order cannot be invoiced");
        }
        LocalDate issued = LocalDate.now(clock);
        Invoice inv = new Invoice(
                nextInvoiceNumber(issued),
                o.getClientId(),
                o.getId(),
                o.getTitle(),
                o.getAmount(),
                issued,
                issued.plusDays(DEFAULT_TERM_DAYS),
                "Draft",
                Instant.now(clock));
        invoices.save(inv);
        audit.record(actor, "Generated invoice " + inv.getId() + " from " + o.getId());
    }

    /** Only drafts can be deleted. Sent and paid invoices stay on record. */
    @Transactional
    public void delete(Member actor, String id) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot delete invoices.");
        Invoice inv = invoices.findById(id).orElseThrow(() -> ApiException.notFound("Invoice not found"));
        if (!"Draft".equals(inv.getStatus())) {
            throw ApiException.conflict("Only draft invoices can be deleted. Sent and paid invoices are kept on record.");
        }
        invoices.delete(inv);
        audit.record(actor, "Deleted draft invoice " + id);
    }

    /** Draft invoice with a server-issued number. Used by recurring billing. */
    @Transactional
    public String issueInvoice(Member actor, UUID clientId, String description, BigDecimal amount, LocalDate due) {
        LocalDate issued = LocalDate.now(clock);
        Invoice inv = new Invoice(nextInvoiceNumber(issued), clientId, null, description, amount, issued, due, "Draft", Instant.now(clock));
        invoices.save(inv);
        audit.record(actor, "Created invoice " + inv.getId());
        return inv.getId();
    }

    @Transactional
    public void setStatus(Member actor, String id, String status) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot change invoices.");
        Invoice inv = invoices.findById(id).orElseThrow(() -> ApiException.notFound("Invoice not found"));
        String next = Validation.oneOf(status, "Status", List.of("Sent", "Paid"));

        if ("Sent".equals(next)) {
            if (!"Draft".equals(inv.getStatus())) {
                throw ApiException.conflict("Only draft invoices can be sent");
            }
            inv.setStatus("Sent");
            audit.record(actor, "Sent invoice " + inv.getId());
            return;
        }
        if (!EDITABLE_STATUSES.contains(inv.getStatus())) {
            throw ApiException.conflict("This invoice is already paid");
        }
        inv.setStatus("Paid");
        String clientName = clients.findById(inv.getClientId()).map(Client::getName).orElse("client");
        ledger.save(new LedgerEntry(
                UUID.randomUUID(),
                LocalDate.now(clock),
                "Payment — " + clientName,
                "Client Payment",
                "Income",
                inv.getAmount(),
                null,
                inv.getId(),
                Instant.now(clock)));
        audit.record(actor, "Marked " + inv.getId() + " as Paid");
    }

    /**
     * Issues the next invoice number. The settings row is locked so concurrent requests
     * receive different numbers.
     */
    private String nextInvoiceNumber(LocalDate issued) {
        WorkspaceSettings s = settings.lockSingleton()
                .orElseThrow(() -> new IllegalStateException("workspace_settings row is missing"));
        String number = Fmt.invoiceNumber(s.getInvoicePrefix(), issued.getYear(), s.getInvoiceNextNumber());
        s.setInvoiceNextNumber(s.getInvoiceNextNumber() + 1);
        return number;
    }

}
