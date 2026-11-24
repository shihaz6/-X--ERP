package com.alchemyx.erp.util;

import com.alchemyx.erp.error.ApiException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;

/** Parsing and small derivations shared by services. */
public final class Parse {

    private Parse() {}

    public static UUID uuid(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest(field + " is required");
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest(field + " is not a valid identifier");
        }
    }

    /** Returns null for a blank value; otherwise the parsed id. */
    public static UUID optionalUuid(String value, String field) {
        return value == null || value.isBlank() ? null : uuid(value, field);
    }

    public static String initials(String name) {
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && sb.length() < 2) {
                sb.append(Character.toUpperCase(part.charAt(0)));
            }
        }
        return sb.isEmpty() ? "?" : sb.toString();
    }

    /** Monday of the week that contains the given date. */
    public static LocalDate monday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
}
