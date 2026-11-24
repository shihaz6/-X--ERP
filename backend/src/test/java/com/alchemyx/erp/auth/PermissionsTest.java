package com.alchemyx.erp.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.alchemyx.erp.model.Role;
import org.junit.jupiter.api.Test;

class PermissionsTest {

    @Test
    void financeDataIsOnlyForSuperAdminAndFinanceManager() {
        assertThat(Permissions.finance(Role.SUPER_ADMIN)).isTrue();
        assertThat(Permissions.finance(Role.FINANCE_MANAGER)).isTrue();
        assertThat(Permissions.finance(Role.PROJECT_MANAGER)).isFalse();
        assertThat(Permissions.finance(Role.DEVELOPER)).isFalse();
    }

    @Test
    void developersCannotSeeOrdersOrTheWholeProjectList() {
        assertThat(Permissions.orders(Role.DEVELOPER)).isFalse();
        assertThat(Permissions.seesAllProjects(Role.DEVELOPER)).isFalse();
        assertThat(Permissions.orders(Role.FINANCE_MANAGER)).isTrue();
    }

    @Test
    void financeManagerHasNoTeamScreen() {
        assertThat(Permissions.team(Role.FINANCE_MANAGER)).isFalse();
        assertThat(Permissions.team(Role.DEVELOPER)).isTrue();
    }

    @Test
    void onlyAdminManagesSettingsAndAccounts() {
        assertThat(Permissions.admin(Role.SUPER_ADMIN)).isTrue();
        assertThat(Permissions.admin(Role.PROJECT_MANAGER)).isFalse();
    }

    @Test
    void managersApproveLeaveAndEditProjects() {
        assertThat(Permissions.manager(Role.PROJECT_MANAGER)).isTrue();
        assertThat(Permissions.editProjects(Role.PROJECT_MANAGER)).isTrue();
        assertThat(Permissions.manager(Role.FINANCE_MANAGER)).isFalse();
        assertThat(Permissions.editProjects(Role.FINANCE_MANAGER)).isFalse();
    }
}
