package com.alchemyx.erp.util;

import com.alchemyx.erp.error.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.Locale;
import java.util.regex.Pattern;

/** Small, explicit input checks. Each failure is a 400 with a message the UI can show. */
public final class Validation {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private Validation() {}

    public static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest(field + " is required");
        }
        return value.trim();
    }

    /** Returns the trimmed value, or null when it is blank. */
    public static String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public static String email(String value) {
        String v = required(value, "Email").toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(v).matches()) {
            throw ApiException.badRequest("Enter a valid email address");
        }
        return v;
    }

    public static String oneOf(String value, String field, Collection<String> allowed) {
        String v = required(value, field);
        if (!allowed.contains(v)) {
            throw ApiException.badRequest(field + " must be one of: " + String.join(", ", allowed));
        }
        return v;
    }

    public static BigDecimal positive(BigDecimal value, String field) {
        if (value == null || value.signum() <= 0) {
            throw ApiException.badRequest(field + " must be greater than 0");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal nonNegative(BigDecimal value, String field) {
        if (value == null || value.signum() < 0) {
            throw ApiException.badRequest(field + " cannot be negative");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public static LocalDate date(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest(field + " is required");
        }
        return parseDate(value, field);
    }

    /** Returns null when the value is blank. */
    public static LocalDate optionalDate(String value, String field) {
        return value == null || value.isBlank() ? null : parseDate(value, field);
    }

    public static void notBefore(LocalDate end, LocalDate start, String message) {
        if (end.isBefore(start)) {
            throw ApiException.badRequest(message);
        }
    }

    private static LocalDate parseDate(String value, String field) {
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(field + " must be a date in the format YYYY-MM-DD");
        }
    }
}
