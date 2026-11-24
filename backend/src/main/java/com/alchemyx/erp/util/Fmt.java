package com.alchemyx.erp.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Formatting shared by services. Dates are ISO strings in the API, matching what the UI expects. */
public final class Fmt {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.ROOT);

    private Fmt() {}

    public static String date(LocalDate d) {
        return d == null ? null : d.toString();
    }

    public static String stamp(Instant instant, ZoneId zone) {
        return instant == null ? null : STAMP.format(instant.atZone(zone));
    }

    /** Invoice number from the workspace prefix, e.g. "AX-INV-{YYYY}-" + 122 becomes "AX-INV-2026-0122". */
    public static String invoiceNumber(String prefix, int year, int number) {
        return prefix.replace("{YYYY}", String.valueOf(year)) + String.format(Locale.ROOT, "%04d", number);
    }

    public static String humanSize(long bytes) {
        if (bytes < 1024L * 1024L) {
            return Math.max(1, Math.round(bytes / 1024.0)) + " KB";
        }
        return BigDecimal.valueOf(bytes / (1024.0 * 1024.0)).setScale(1, RoundingMode.HALF_UP) + " MB";
    }

    public static BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }
}
