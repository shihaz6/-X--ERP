package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.SubscriptionDto;
import com.alchemyx.erp.api.Dtos.SubscriptionRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Client;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.Subscription;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.SubscriptionRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Recurring client subscriptions. Each billing run issues a draft invoice and moves the billing date forward one month. */
@Service
public class SubscriptionService {

    public static final List<String> STATUSES = List.of("Active", "Paused", "Cancelled");
    private static final int TERM_DAYS = 30;

    private final SubscriptionRepository subscriptions;
    private final ClientRepository clients;
    private final InvoiceService invoices;
    private final AuditService audit;
    private final Clock clock;

    public SubscriptionService(SubscriptionRepository subscriptions, ClientRepository clients, InvoiceService invoices,
                               AuditService audit, Clock clock) {
        this.subscriptions = subscriptions;
        this.clients = clients;
        this.invoices = invoices;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionDto> list(Member viewer) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view subscriptions.");
        Map<UUID, String> names = clients.findAll().stream().collect(Collectors.toMap(Client::getId, Client::getName));
        return subscriptions.findAllByOrderByNextBillingDateAsc().stream()
                .map(s -> toDto(s, names.getOrDefault(s.getClientId(), "—")))
                .toList();
    }

    static SubscriptionDto toDto(Subscription s, String clientName) {
        return new SubscriptionDto(
                s.getId().toString(),
                s.getClientId().toString(),
                clientName,
                s.getPlan(),
                s.getMonthlyAmount(),
                Fmt.date(s.getStartDate()),
                Fmt.date(s.getNextBillingDate()),
                s.getStatus());
    }

    @Transactional
    public void create(Member actor, SubscriptionRequest req) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot add subscriptions.");
        UUID clientId = Parse.uuid(req.clientId(), "Client");
        if (!clients.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        String plan = Validation.required(req.plan(), "Plan name");
        BigDecimal amount = Validation.positive(req.monthlyAmount(), "Monthly amount");
        LocalDate start = Validation.date(req.start(), "Start date");
        subscriptions.save(new Subscription(UUID.randomUUID(), clientId, plan, amount, start, Instant.now(clock)));
        audit.record(actor, "Created subscription " + plan + " for " + clientName(clientId));
    }

    @Transactional
    public void setStatus(Member actor, UUID id, String status) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot change subscriptions.");
        Subscription s = find(id);
        if ("Cancelled".equals(s.getStatus())) {
            throw ApiException.conflict("A cancelled subscription cannot be changed");
        }
        String next = Validation.oneOf(status, "Status", STATUSES);
        s.setStatus(next);
        audit.record(actor, "Set subscription " + s.getPlan() + " to " + next);
    }

    /** Issues the next period's invoice for one active subscription. */
    @Transactional
    public String bill(Member actor, UUID id) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot bill subscriptions.");
        return billOne(actor, find(id));
    }

    /** Bills every active subscription whose billing date has arrived. */
    @Transactional
    public int billDue(Member actor) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Your role cannot bill subscriptions.");
        LocalDate today = LocalDate.now(clock);
        int count = 0;
        for (Subscription s : subscriptions.findByStatusAndNextBillingDateLessThanEqual("Active", today)) {
            billOne(actor, s);
            count++;
        }
        return count;
    }

    private String billOne(Member actor, Subscription s) {
        if (!"Active".equals(s.getStatus())) {
            throw ApiException.conflict("Only active subscriptions can be billed");
        }
        YearMonth period = YearMonth.from(s.getNextBillingDate());
        String description = "Subscription " + s.getPlan() + " - "
                + period.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + period.getYear();
        LocalDate due = LocalDate.now(clock).plusDays(TERM_DAYS);
        String invoiceId = invoices.issueInvoice(actor, s.getClientId(), description, s.getMonthlyAmount(), due);
        s.setNextBillingDate(s.getNextBillingDate().plusMonths(1));
        audit.record(actor, "Billed subscription " + s.getPlan() + " as " + invoiceId);
        return invoiceId;
    }

    private Subscription find(UUID id) {
        return subscriptions.findById(id).orElseThrow(() -> ApiException.notFound("Subscription not found"));
    }

    private String clientName(UUID clientId) {
        return clients.findById(clientId).map(Client::getName).orElse("client");
    }
}
