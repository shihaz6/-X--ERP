package com.alchemyx.erp.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.alchemyx.erp.model.Invoice;
import com.alchemyx.erp.util.Fmt;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InvoiceRulesTest {

    private static Invoice invoice(String status, LocalDate due) {
        return new Invoice("INV-1", UUID.randomUUID(), null, "x", BigDecimal.TEN,
                due.minusDays(30), due, status, null);
    }

    @Test
    void sentInvoicePastDueIsReportedOverdue() {
        LocalDate today = LocalDate.of(2026, 6, 15);
        assertThat(InvoiceService.effectiveStatus(invoice("Sent", today.minusDays(1)), today)).isEqualTo("Overdue");
    }

    @Test
    void sentInvoiceDueTodayIsNotOverdue() {
        LocalDate today = LocalDate.of(2026, 6, 15);
        assertThat(InvoiceService.effectiveStatus(invoice("Sent", today), today)).isEqualTo("Sent");
    }

    @Test
    void paidAndDraftInvoicesAreNeverOverdue() {
        LocalDate today = LocalDate.of(2026, 6, 15);
        assertThat(InvoiceService.effectiveStatus(invoice("Paid", today.minusDays(10)), today)).isEqualTo("Paid");
        assertThat(InvoiceService.effectiveStatus(invoice("Draft", today.minusDays(10)), today)).isEqualTo("Draft");
    }

    @Test
    void invoiceNumberUsesPrefixYearAndPaddedSequence() {
        assertThat(Fmt.invoiceNumber("AX-INV-{YYYY}-", 2026, 122)).isEqualTo("AX-INV-2026-0122");
        assertThat(Fmt.invoiceNumber("INV-", 2026, 7)).isEqualTo("INV-0007");
    }

    @Test
    void fileSizesAreReadableInKbOrMb() {
        assertThat(Fmt.humanSize(420 * 1024L)).isEqualTo("420 KB");
        assertThat(Fmt.humanSize(1_300_000L)).isEqualTo("1.2 MB");
        assertThat(Fmt.humanSize(10)).isEqualTo("1 KB");
    }
}
