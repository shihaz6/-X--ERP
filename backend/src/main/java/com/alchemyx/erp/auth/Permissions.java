package com.alchemyx.erp.auth;

import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Role;

/**
 * Role rules. These mirror the access matrix the UI was built around, so the server
 * enforces the same boundaries the screens show.
 */
public final class Permissions {

    private Permissions() {}

    /** Finance data: invoices, transactions, finance analytics. */
    public static boolean finance(Role r) {
        return r == Role.SUPER_ADMIN || r == Role.FINANCE_MANAGER;
    }

    /** Edit finance records: record payments, issue invoices, record transactions, mark milestones paid. */
    public static boolean editFinance(Role r) {
        return finance(r);
    }

    /** Clients & CRM screen. */
    public static boolean crm(Role r) {
        return r == Role.SUPER_ADMIN || r == Role.PROJECT_MANAGER || r == Role.FINANCE_MANAGER;
    }

    public static boolean editCrm(Role r) {
        return r == Role.SUPER_ADMIN || r == Role.PROJECT_MANAGER;
    }

    /** Orders screen. Developers cannot see or change orders. */
    public static boolean orders(Role r) {
        return r != Role.DEVELOPER;
    }

    /** Team screen. Finance managers do not see it. */
    public static boolean team(Role r) {
        return r != Role.FINANCE_MANAGER;
    }

    /** Managers approve leave and see every timesheet. */
    public static boolean manager(Role r) {
        return r == Role.SUPER_ADMIN || r == Role.PROJECT_MANAGER;
    }

    /** Create/edit projects, their team and their status. */
    public static boolean editProjects(Role r) {
        return r == Role.SUPER_ADMIN || r == Role.PROJECT_MANAGER;
    }

    /** Settings, member accounts and the audit log. */
    public static boolean admin(Role r) {
        return r == Role.SUPER_ADMIN;
    }

    /** Non-admin members can see only projects they are on. */
    public static boolean seesAllProjects(Role r) {
        return r != Role.DEVELOPER;
    }

    public static void require(boolean allowed, String message) {
        if (!allowed) {
            throw ApiException.forbidden(message);
        }
    }
}
