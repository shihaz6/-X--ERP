package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.CashPointDto;
import com.alchemyx.erp.api.Dtos.FinanceAnalyticsDto;
import com.alchemyx.erp.api.Dtos.FiscalYearDto;
import com.alchemyx.erp.api.Dtos.MonthPointDto;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.model.Client;
import com.alchemyx.erp.model.Invoice;
import com.alchemyx.erp.model.LedgerEntry;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.InvoiceRepository;
import com.alchemyx.erp.repository.LedgerRepository;
import com.alchemyx.erp.repository.SubscriptionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;

/** Finance time series and balances, all derived from ledger, invoice and client records. */
@Service
public class AnalyticsService {

    private final LedgerRepository ledger;
    private final InvoiceRepository invoices;
    private final ClientRepository clients;
    private final SettingsService settings;
    private final SubscriptionRepository subscriptions;
    private final Clock clock;

    public AnalyticsService(LedgerRepository ledger, InvoiceRepository invoices, ClientRepository clients,
                            SettingsService settings, SubscriptionRepository subscriptions, Clock clock) {
        this.subscriptions = subscriptions;
        this.ledger = ledger;
        this.invoices = invoices;
        this.clients = clients;
        this.settings = settings;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public FinanceAnalyticsDto finance(Member viewer) {
        Permissions.require(Permissions.finance(viewer.getRole()), "Your role cannot view finance analytics.");
        LocalDate today = LocalDate.now(clock);
        List<LedgerEntry> entries = ledger.findAll();
        List<Client> clientList = clients.findAll();
        List<Invoice> invoiceList = invoices.findAll();
        BigDecimal opening = settings.openingCash();

        // Last 12 calendar months, oldest first.
        YearMonth current = YearMonth.from(today);
        List<MonthPointDto> months = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            YearMonth ym = current.minusMonths(i);
            BigDecimal revenue = sum(entries, e -> "Income".equals(e.getType()) && YearMonth.from(e.getTxnDate()).equals(ym));
            BigDecimal expenses = sum(entries, e -> "Expense".equals(e.getType()) && YearMonth.from(e.getTxnDate()).equals(ym));
            int newClients = (int) clientList.stream()
                    .filter(c -> c.getSince() != null && YearMonth.from(c.getSince()).equals(ym))
                    .count();
            months.add(new MonthPointDto(
                    ym.toString(),
                    ym.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH),
                    revenue,
                    expenses,
                    newClients));
        }

        // Last three fiscal years, starting in the configured fiscal-year month.
        int startMonth = switch (settings.current().getFiscalYearStart()) {
            case "January" -> 1;
            case "April" -> 4;
            default -> 7;
        };
        YearMonth fyStart = YearMonth.of(
                today.getMonthValue() >= startMonth ? today.getYear() : today.getYear() - 1, startMonth);
        List<FiscalYearDto> fiscalYears = new ArrayList<>();
        for (int k = 2; k >= 0; k--) {
            YearMonth start = fyStart.minusYears(k);
            YearMonth end = start.plusMonths(12);
            BigDecimal revenue = sum(entries, e -> "Income".equals(e.getType())
                    && !YearMonth.from(e.getTxnDate()).isBefore(start) && YearMonth.from(e.getTxnDate()).isBefore(end));
            BigDecimal expenses = sum(entries, e -> "Expense".equals(e.getType())
                    && !YearMonth.from(e.getTxnDate()).isBefore(start) && YearMonth.from(e.getTxnDate()).isBefore(end));
            int y = start.getYear();
            fiscalYears.add(new FiscalYearDto("FY " + y + "/" + String.format(Locale.ROOT, "%02d", (y + 1) % 100), revenue, expenses));
        }

        // Cash balance at the end of each of the last 12 months.
        List<CashPointDto> cash = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            YearMonth ym = current.minusMonths(i);
            BigDecimal balance = opening
                    .add(sum(entries, e -> "Income".equals(e.getType()) && YearMonth.from(e.getTxnDate()).compareTo(ym) <= 0))
                    .subtract(sum(entries, e -> "Expense".equals(e.getType()) && YearMonth.from(e.getTxnDate()).compareTo(ym) <= 0));
            cash.add(new CashPointDto(ym.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH), balance));
        }
        BigDecimal cashPosition = opening
                .add(sum(entries, e -> "Income".equals(e.getType())))
                .subtract(sum(entries, e -> "Expense".equals(e.getType())));

        BigDecimal outstanding = BigDecimal.ZERO;
        BigDecimal overdue = BigDecimal.ZERO;
        for (Invoice inv : invoiceList) {
            String status = InvoiceService.effectiveStatus(inv, today);
            if ("Sent".equals(status) || "Overdue".equals(status)) {
                outstanding = outstanding.add(inv.getAmount());
            }
            if ("Overdue".equals(status)) {
                overdue = overdue.add(inv.getAmount());
            }
        }
        LocalDate thirtyDaysAgo = today.minusDays(30);
        BigDecimal recurring = sum(entries, e -> "Income".equals(e.getType())
                && "Subscription".equals(e.getCategory())
                && !e.getTxnDate().isBefore(thirtyDaysAgo));

        BigDecimal monthlyRecurring = subscriptions.findAll().stream()
                .filter(s -> "Active".equals(s.getStatus()))
                .map(s -> s.getMonthlyAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new FinanceAnalyticsDto(months, fiscalYears, cash, cashPosition, outstanding, overdue, recurring, monthlyRecurring);
    }

    private static BigDecimal sum(List<LedgerEntry> entries, Predicate<LedgerEntry> match) {
        BigDecimal total = BigDecimal.ZERO;
        for (LedgerEntry e : entries) {
            if (match.test(e)) {
                total = total.add(e.getAmount());
            }
        }
        return total;
    }
}
