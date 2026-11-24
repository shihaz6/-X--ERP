package com.alchemyx.erp.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.alchemyx.erp.error.ApiException;

/** Access roles. The label is the name shown in the UI and used in the API. */
public enum Role {
    SUPER_ADMIN("Super Admin"),
    FINANCE_MANAGER("Finance Manager"),
    PROJECT_MANAGER("Project Manager"),
    DEVELOPER("Developer");

    private final String label;

    Role(String label) {
        this.label = label;
    }

    @JsonValue
    public String label() {
        return label;
    }

    @JsonCreator
    public static Role fromLabel(String value) {
        return parse(value);
    }

    public static Role parse(String value) {
        for (Role r : values()) {
            if (r.label.equalsIgnoreCase(value) || r.name().equalsIgnoreCase(value)) {
                return r;
            }
        }
        throw ApiException.badRequest("Unknown role: " + value);
    }
}
