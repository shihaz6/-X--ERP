package com.alchemyx.erp.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Role;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class ValidationTest {

    @Test
    void emailIsNormalisedAndChecked() {
        assertThat(Validation.email("  Nadun@AlchemyX.lk ")).isEqualTo("nadun@alchemyx.lk");
        assertThatThrownBy(() -> Validation.email("not-an-email")).isInstanceOf(ApiException.class);
    }

    @Test
    void enumValuesMustBeFromTheAllowedList() {
        assertThat(Validation.oneOf("Active", "Status", List.of("Active", "Planning"))).isEqualTo("Active");
        assertThatThrownBy(() -> Validation.oneOf("Closed", "Status", List.of("Active", "Planning")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void amountsMustBePositive() {
        assertThat(Validation.positive(new BigDecimal("10"), "Amount")).isEqualByComparingTo("10.00");
        assertThatThrownBy(() -> Validation.positive(BigDecimal.ZERO, "Amount")).isInstanceOf(ApiException.class);
    }

    @Test
    void endDateCannotBeBeforeStart() {
        assertThatThrownBy(() -> Validation.notBefore(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 2, 1), "bad"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void mondayIsFoundForAnyDayOfTheWeek() {
        LocalDate friday = LocalDate.of(2026, 6, 12);
        assertThat(friday.getDayOfWeek()).isEqualTo(DayOfWeek.FRIDAY);
        assertThat(Parse.monday(friday)).isEqualTo(LocalDate.of(2026, 6, 8));
    }

    @Test
    void initialsUseFirstTwoWords() {
        assertThat(Parse.initials("nadun perera")).isEqualTo("NP");
        assertThat(Parse.initials("Cher")).isEqualTo("C");
    }

    @Test
    void roleLabelsRoundTrip() {
        assertThat(Role.parse("Finance Manager")).isEqualTo(Role.FINANCE_MANAGER);
        assertThat(Role.parse("DEVELOPER")).isEqualTo(Role.DEVELOPER);
        assertThatThrownBy(() -> Role.parse("Intern")).isInstanceOf(ApiException.class);
    }
}
