package com.alchemyx.erp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A member's week submitted for approval. Status is Submitted, Approved or Rejected. */
@Entity
@Table(name = "timesheet_submissions")
@IdClass(TimesheetSubmission.Key.class)
@Getter
@Setter
@NoArgsConstructor
public class TimesheetSubmission {

    @Id
    @Column(name = "member_id")
    private UUID memberId;
    @Id
    @Column(name = "week_start")
    private LocalDate weekStart;
    private String status;
    @Column(name = "submitted_at")
    private Instant submittedAt;
    @Column(name = "decided_by")
    private UUID decidedBy;
    @Column(name = "decided_at")
    private Instant decidedAt;

    public TimesheetSubmission(UUID memberId, LocalDate weekStart, Instant submittedAt) {
        this.memberId = memberId;
        this.weekStart = weekStart;
        this.status = "Submitted";
        this.submittedAt = submittedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private UUID memberId;
        private LocalDate weekStart;

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof Key k)) {
                return false;
            }
            return Objects.equals(memberId, k.memberId) && Objects.equals(weekStart, k.weekStart);
        }

        @Override
        public int hashCode() {
            return Objects.hash(memberId, weekStart);
        }
    }
}
