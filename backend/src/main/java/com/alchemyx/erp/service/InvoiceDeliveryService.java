package com.alchemyx.erp.service;

import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Client;
import com.alchemyx.erp.model.Invoice;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.WorkspaceSettings;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.InvoiceRepository;
import com.alchemyx.erp.repository.WorkspaceSettingsRepository;
import com.alchemyx.erp.util.Fmt;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Invoice PDFs, emailing invoices to clients, and overdue reminders to the billing address. */
@Service
public class InvoiceDeliveryService {

    private final InvoiceRepository invoiceRepo;
    private final InvoiceService invoices;
    private final ClientRepository clients;
    private final WorkspaceSettingsRepository settings;
    private final InvoicePdfService pdf;
    private final EmailService email;
    private final AuditService audit;
    private final Clock clock;

    public InvoiceDeliveryService(InvoiceRepository invoiceRepo, InvoiceService invoices, ClientRepository clients,
                                  WorkspaceSettingsRepository settings, InvoicePdfService pdf, EmailService email,
                                  AuditService audit, Clock clock) {
        this.invoiceRepo = invoiceRepo;
        this.invoices = invoices;
        this.clients = clients;
        this.settings = settings;
        this.pdf = pdf;
        this.email = email;
        this.audit = audit;
        this.clock = clock;
    }

    public record SendResult(boolean emailed) {}

    /** Marks a draft as sent and emails the PDF to the client. Sent invoices can be emailed again. */
    @Transactional
    public SendResult send(Member actor, String id) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot send invoices.");
        Invoice inv = invoiceRepo.findById(id).orElseThrow(() -> ApiException.notFound("Invoice not found"));
        if ("Paid".equals(inv.getStatus())) {
            throw ApiException.conflict("A paid invoice cannot be sent again");
        }
        if ("Draft".equals(inv.getStatus())) {
            invoices.setStatus(actor, id, "Sent");
            inv = invoiceRepo.findById(id).orElseThrow();
        }
        Client client = clients.findById(inv.getClientId()).orElseThrow(() -> ApiException.notFound("Client not found"));
        WorkspaceSettings s = settings.findById(1).orElseThrow();
        byte[] document = pdf.render(inv, client, s);
        String company = s.getCompanyName() == null || s.getCompanyName().isBlank() ? "AlchemyX" : s.getCompanyName();
        String body = "Dear " + client.getContact() + ",\n\nPlease find invoice " + inv.getId() + " attached.\n"
                + "Amount due: LKR " + String.format(Locale.ENGLISH, "%,.2f", inv.getAmount()) + "\n"
                + "Due date: " + Fmt.date(inv.getDueOn()) + "\n\nThank you,\n" + company;
        boolean sent = email.send(client.getEmail(), "Invoice " + inv.getId() + " from " + company, body, document, inv.getId() + ".pdf");
        audit.record(actor, sent ? "Emailed invoice " + inv.getId() + " to " + client.getEmail()
                : "Marked invoice " + inv.getId() + " sent (email not delivered: mail is not configured)");
        return new SendResult(sent);
    }

    @Transactional(readOnly = true)
    public byte[] pdf(Member viewer, String id) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view invoices.");
        Invoice inv = invoiceRepo.findById(id).orElseThrow(() -> ApiException.notFound("Invoice not found"));
        Client client = clients.findById(inv.getClientId()).orElseThrow(() -> ApiException.notFound("Client not found"));
        return pdf.render(inv, client, settings.findById(1).orElseThrow());
    }

    /** Daily job: lists overdue invoices to the billing address when the overdue alert is switched on. */
    @Transactional(readOnly = true)
    public void sendOverdueReminders() {
        WorkspaceSettings s = settings.findById(1).orElseThrow();
        if (!s.isNotifyOverdue() || s.getBillingEmail() == null || s.getBillingEmail().isBlank()) {
            return;
        }
        LocalDate today = LocalDate.now(clock);
        List<Invoice> overdue = invoiceRepo.findAll().stream()
                .filter(i -> "Sent".equals(i.getStatus()) && i.getDueOn().isBefore(today))
                .toList();
        if (overdue.isEmpty()) {
            return;
        }
        StringBuilder body = new StringBuilder("These invoices are past their due date:\n\n");
        for (Invoice i : overdue) {
            String client = clients.findById(i.getClientId()).map(Client::getName).orElse("—");
            body.append(i.getId()).append("  ").append(client).append("  LKR ")
                    .append(String.format(Locale.ENGLISH, "%,.2f", i.getAmount())).append("  due ")
                    .append(Fmt.date(i.getDueOn())).append('\n');
        }
        email.send(s.getBillingEmail(), "Overdue invoices: " + overdue.size(), body.toString(), null, null);
    }
}
