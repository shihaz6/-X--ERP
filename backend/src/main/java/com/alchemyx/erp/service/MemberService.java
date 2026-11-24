package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.MemberCreateRequest;
import com.alchemyx.erp.api.Dtos.MemberDto;
import com.alchemyx.erp.api.Dtos.MemberUpdateRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.LeaveRequest;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.TimesheetEntry;
import com.alchemyx.erp.model.Role;
import com.alchemyx.erp.repository.LeaveRepository;
import com.alchemyx.erp.repository.MemberRepository;
import com.alchemyx.erp.repository.TimesheetRepository;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberService {

    private final MemberRepository members;
    private final TimesheetRepository timesheets;
    private final LeaveRepository leaves;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final Clock clock;

    public MemberService(MemberRepository members, TimesheetRepository timesheets, LeaveRepository leaves,
                         PasswordEncoder encoder, AuditService audit, Clock clock) {
        this.members = members;
        this.timesheets = timesheets;
        this.leaves = leaves;
        this.encoder = encoder;
        this.audit = audit;
        this.clock = clock;
    }

    /** Hours logged this week and members on approved leave today, used to derive member cards. */
    public record WeekView(Map<UUID, Integer> hours, Set<UUID> onLeave) {}

    @Transactional(readOnly = true)
    public WeekView currentWeek() {
        LocalDate today = LocalDate.now(clock);
        LocalDate monday = Parse.monday(today);
        Map<UUID, Integer> hours = new HashMap<>();
        for (TimesheetEntry t : timesheets.findByWorkDateBetween(monday, monday.plusDays(6))) {
            hours.merge(t.getMemberId(), t.getHours(), Integer::sum);
        }
        Set<UUID> onLeave = leaves
                .findByStatusAndFromDateLessThanEqualAndToDateGreaterThanEqual("Approved", today, today)
                .stream().map(LeaveRequest::getMemberId).collect(Collectors.toSet());
        return new WeekView(hours, onLeave);
    }

    @Transactional(readOnly = true)
    public List<MemberDto> list() {
        WeekView view = currentWeek();
        return members.findAllByOrderByNameAsc().stream().map(m -> toDto(m, view)).toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, String> namesById() {
        return members.findAll().stream().collect(Collectors.toMap(Member::getId, Member::getName));
    }

    @Transactional(readOnly = true)
    public MemberDto dto(Member member) {
        return toDto(member, currentWeek());
    }

    public MemberDto toDto(Member m, WeekView view) {
        String status = view.onLeave().contains(m.getId()) ? "On Leave" : m.getAvailability();
        return new MemberDto(
                m.getId().toString(),
                m.getName(),
                m.getEmail(),
                m.getJobTitle(),
                m.getDepartment(),
                m.getRole().label(),
                view.hours().getOrDefault(m.getId(), 0),
                m.getCapacityHours(),
                status,
                m.getInitials());
    }

    @Transactional
    public MemberDto create(Member actor, MemberCreateRequest req) {
        Permissions.require(Permissions.admin(actor.getRole()), "Only a Super Admin can add team members.");
        String name = Validation.required(req.name(), "Name");
        String username = Validation.username(req.username());
        if (members.existsByUsernameIgnoreCase(username)) {
            throw ApiException.conflict("That username is already taken");
        }
        String email = Validation.email(req.email());
        if (members.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("A team member with this email already exists");
        }
        String password = Validation.required(req.password(), "Password");
        if (password.length() < 8) {
            throw ApiException.badRequest("Password must be at least 8 characters");
        }
        Role role = Role.parse(Validation.required(req.access(), "Access role"));
        Member m = new Member(
                UUID.randomUUID(),
                name,
                username,
                email,
                encoder.encode(password),
                role,
                nullToEmpty(req.jobTitle()),
                nullToEmpty(req.department()),
                Parse.initials(name),
                capacity(req.capacityHours()),
                Instant.now(clock));
        members.save(m);
        audit.record(actor, "Added team member " + name + " as " + role.label());
        return toDto(m, currentWeek());
    }

    @Transactional
    public MemberDto update(Member actor, UUID id, MemberUpdateRequest req) {
        Member m = members.findById(id).orElseThrow(() -> ApiException.notFound("Team member not found"));

        boolean profileChange = req.access() != null || req.jobTitle() != null
                || req.department() != null || req.capacityHours() != null;
        if (profileChange) {
            Permissions.require(Permissions.admin(actor.getRole()), "Only a Super Admin can change member details.");
        }
        if (req.availability() != null) {
            Permissions.require(Permissions.manager(actor.getRole()) || Permissions.admin(actor.getRole()),
                    "Only managers can change availability.");
            m.setAvailability(Validation.oneOf(req.availability(), "Availability", List.of("Available", "Busy")));
        }
        if (req.access() != null) {
            Role next = Role.parse(req.access());
            if (m.getRole() == Role.SUPER_ADMIN && next != Role.SUPER_ADMIN && activeSuperAdmins() <= 1) {
                throw ApiException.conflict("At least one active Super Admin must remain.");
            }
            if (next != m.getRole()) {
                m.setRole(next);
                audit.record(actor, "Changed role of " + m.getName() + " to " + next.label());
            }
        }
        if (req.jobTitle() != null) {
            m.setJobTitle(req.jobTitle().trim());
        }
        if (req.department() != null) {
            m.setDepartment(req.department().trim());
        }
        if (req.capacityHours() != null) {
            m.setCapacityHours(capacity(req.capacityHours()));
        }
        return toDto(m, currentWeek());
    }

    private long activeSuperAdmins() {
        return members.findAll().stream().filter(x -> x.getRole() == Role.SUPER_ADMIN && x.isActive()).count();
    }

    private static int capacity(Integer hours) {
        if (hours == null) {
            return 40;
        }
        if (hours < 0 || hours > 168) {
            throw ApiException.badRequest("Capacity must be between 0 and 168 hours");
        }
        return hours;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
