package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.LeaveDto;
import com.alchemyx.erp.api.Dtos;
import com.alchemyx.erp.api.Dtos.TimesheetEntryDto;
import com.alchemyx.erp.api.Dtos.TimesheetRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.LeaveRequest;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.TimesheetEntry;
import com.alchemyx.erp.repository.LeaveRepository;
import com.alchemyx.erp.repository.MemberRepository;
import com.alchemyx.erp.repository.TimesheetRepository;
import com.alchemyx.erp.repository.TimesheetSubmissionRepository;
import com.alchemyx.erp.model.TimesheetSubmission;
import com.alchemyx.erp.api.Dtos.TimesheetSubmissionDto;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Timesheets (Mon-Fri, 0-16h per day) and leave requests with manager approval. */
@Service
public class TeamService {

    public static final List<String> LEAVE_TYPES = List.of("Annual", "Sick", "Personal", "Unpaid");
    private static final int MAX_HOURS_PER_DAY = 16;

    private final TimesheetRepository timesheets;
    private final TimesheetSubmissionRepository submissions;
    private final LeaveRepository leaves;
    private final MemberRepository members;
    private final AuditService audit;
    private final Clock clock;

    public TeamService(TimesheetRepository timesheets, TimesheetSubmissionRepository submissions, LeaveRepository leaves,
                       MemberRepository members, AuditService audit, Clock clock) {
        this.timesheets = timesheets;
        this.submissions = submissions;
        this.leaves = leaves;
        this.members = members;
        this.audit = audit;
        this.clock = clock;
    }

    /** Managers see every timesheet; other members see only their own. */
    @Transactional(readOnly = true)
    public List<TimesheetEntryDto> timesheet(Member viewer, LocalDate weekStart) {
        LocalDate monday = Parse.monday(weekStart);
        return timesheets.findByWorkDateBetween(monday, monday.plusDays(4)).stream()
                .filter(t -> Permissions.manager(viewer.getRole()) || t.getMemberId().equals(viewer.getId()))
                .map(t -> new TimesheetEntryDto(t.getMemberId().toString(), Fmt.date(t.getWorkDate()), t.getHours()))
                .toList();
    }

    @Transactional
    public void saveTimesheet(Member actor, TimesheetRequest req) {
        LocalDate monday = Parse.monday(Validation.date(req.weekStart(), "Week start"));
        LocalDate friday = monday.plusDays(4);
        if (req.entries() == null) {
            throw ApiException.badRequest("Entries are required");
        }
        for (TimesheetEntryDto e : req.entries()) {
            UUID memberId = Parse.uuid(e.memberId(), "Member");
            if (submissions.findById(new TimesheetSubmission.Key(memberId, monday))
                    .map(x -> "Approved".equals(x.getStatus())).orElse(false)) {
                throw ApiException.conflict("This week has been approved and can no longer be changed");
            }
            if (!memberId.equals(actor.getId())) {
                Permissions.require(Permissions.manager(actor.getRole()), "You can only log your own hours.");
            }
            if (!members.existsById(memberId)) {
                throw ApiException.notFound("Team member not found");
            }
            LocalDate day = Validation.date(e.date(), "Date");
            if (day.isBefore(monday) || day.isAfter(friday) || day.getDayOfWeek().getValue() > 5) {
                throw ApiException.badRequest("Hours can only be logged for Monday to Friday of the selected week");
            }
            if (e.hours() < 0 || e.hours() > MAX_HOURS_PER_DAY) {
                throw ApiException.badRequest("Hours per day must be between 0 and " + MAX_HOURS_PER_DAY);
            }
            timesheets.save(new TimesheetEntry(memberId, day, e.hours()));
        }
    }

    /** Members submit their week; a manager then approves or rejects it. */
    @Transactional
    public void submitTimesheet(Member actor, String weekStart) {
        LocalDate monday = Parse.monday(Validation.date(weekStart, "Week start"));
        TimesheetSubmission.Key key = new TimesheetSubmission.Key(actor.getId(), monday);
        TimesheetSubmission existing = submissions.findById(key).orElse(null);
        if (existing != null && "Approved".equals(existing.getStatus())) {
            throw ApiException.conflict("This week has already been approved");
        }
        if (existing == null) {
            submissions.save(new TimesheetSubmission(actor.getId(), monday, Instant.now(clock)));
        } else {
            existing.setStatus("Submitted");
            existing.setSubmittedAt(Instant.now(clock));
        }
        audit.record(actor, "Submitted weekly timesheet for week of " + Fmt.date(monday));
    }

    @Transactional(readOnly = true)
    public List<TimesheetSubmissionDto> submissions(LocalDate weekStart) {
        return submissions.findByWeekStart(Parse.monday(weekStart)).stream()
                .map(x -> new TimesheetSubmissionDto(x.getMemberId().toString(), Fmt.date(x.getWeekStart()), x.getStatus()))
                .toList();
    }

    @Transactional
    public void decideWeek(Member actor, UUID memberId, String weekStart, String status) {
        Permissions.require(Permissions.manager(actor.getRole()), "Only managers can approve timesheets.");
        LocalDate monday = Parse.monday(Validation.date(weekStart, "Week start"));
        TimesheetSubmission s = submissions.findById(new TimesheetSubmission.Key(memberId, monday))
                .orElseThrow(() -> ApiException.notFound("No submitted timesheet for that week"));
        if (!"Submitted".equals(s.getStatus())) {
            throw ApiException.conflict("This timesheet has already been decided");
        }
        String next = Validation.oneOf(status, "Status", List.of("Approved", "Rejected"));
        s.setStatus(next);
        s.setDecidedBy(actor.getId());
        s.setDecidedAt(Instant.now(clock));
        String name = members.findById(memberId).map(m -> m.getName()).orElse("team member");
        audit.record(actor, next + " timesheet for " + name + " (week of " + Fmt.date(monday) + ")");
    }

    @Transactional(readOnly = true)
    public List<LeaveDto> leaves() {
        return leaves.findAllByOrderByFromDateDesc().stream().map(TeamService::toDto).toList();
    }

    static LeaveDto toDto(LeaveRequest l) {
        return new LeaveDto(
                l.getId().toString(),
                l.getMemberId().toString(),
                Fmt.date(l.getFromDate()),
                Fmt.date(l.getToDate()),
                l.getLeaveType(),
                l.getStatus());
    }

    @Transactional
    public void requestLeave(Member actor, Dtos.LeaveRequest req) {
        String type = Validation.oneOf(req.type(), "Leave type", LEAVE_TYPES);
        LocalDate from = Validation.date(req.from(), "From date");
        LocalDate to = Validation.date(req.to(), "To date");
        Validation.notBefore(to, from, "End date must be on or after the start date");
        LeaveRequest l = new LeaveRequest(UUID.randomUUID(), actor.getId(), type, from, to, Instant.now(clock));
        leaves.save(l);
        audit.record(actor, "Requested " + type.toLowerCase() + " leave " + Fmt.date(from) + " to " + Fmt.date(to));
    }

    @Transactional
    public void decideLeave(Member actor, UUID id, String status) {
        Permissions.require(Permissions.manager(actor.getRole()), "Only managers can approve leave.");
        LeaveRequest l = leaves.findById(id).orElseThrow(() -> ApiException.notFound("Leave request not found"));
        if (!"Pending".equals(l.getStatus())) {
            throw ApiException.conflict("This leave request has already been decided");
        }
        String next = Validation.oneOf(status, "Status", List.of("Approved", "Rejected"));
        l.setStatus(next);
        l.setDecidedBy(actor.getId());
        l.setDecidedAt(Instant.now(clock));
        String name = members.findById(l.getMemberId()).map(m -> m.getName()).orElse("team member");
        audit.record(actor, next + " leave for " + name);
    }

    /** Helper for the workspace: member id to name for leave rows. */
    @Transactional(readOnly = true)
    public Map<UUID, String> names() {
        return members.findAll().stream().collect(Collectors.toMap(m -> m.getId(), m -> m.getName()));
    }
}
