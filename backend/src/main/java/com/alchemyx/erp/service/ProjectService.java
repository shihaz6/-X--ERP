package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.MilestoneDto;
import com.alchemyx.erp.api.Dtos.ProjectDto;
import com.alchemyx.erp.api.Dtos.ProjectRequest;
import com.alchemyx.erp.api.Dtos.TaskDto;
import com.alchemyx.erp.api.Dtos.TaskRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.LedgerEntry;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.Project;
import com.alchemyx.erp.model.ProjectMilestone;
import com.alchemyx.erp.model.ProjectTask;
import com.alchemyx.erp.model.Role;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.DocumentRepository;
import com.alchemyx.erp.repository.LedgerRepository;
import com.alchemyx.erp.repository.ProjectRepository;
import com.alchemyx.erp.repository.ServiceOrderRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    public static final List<String> STATUSES = List.of("Planning", "Active", "On Hold", "Completed");
    public static final List<String> PRIORITIES = List.of("Low", "Medium", "High", "Critical");
    public static final List<String> TASK_STATUSES = List.of("Backlog", "In Progress", "Review", "Done");

    private final ProjectRepository projects;
    private final ClientRepository clients;
    private final LedgerRepository ledger;
    private final ServiceOrderRepository orders;
    private final DocumentRepository documents;
    private final MemberService members;
    private final AuditService audit;
    private final Clock clock;

    public ProjectService(ProjectRepository projects, ClientRepository clients, LedgerRepository ledger,
                          ServiceOrderRepository orders, DocumentRepository documents, MemberService members,
                          AuditService audit, Clock clock) {
        this.projects = projects;
        this.clients = clients;
        this.ledger = ledger;
        this.orders = orders;
        this.documents = documents;
        this.members = members;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> list(Member viewer) {
        List<Project> rows = Permissions.seesAllProjects(viewer.getRole())
                ? projects.findAllByOrderByStartDateDesc()
                : projects.findByTeamContainingOrderByStartDateDesc(viewer.getId());
        Map<UUID, BigDecimal> spent = spentByProject();
        return rows.stream().map(p -> toDto(p, spent)).toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, BigDecimal> spentByProject() {
        Map<UUID, BigDecimal> spent = new HashMap<>();
        for (LedgerEntry e : ledger.findAll()) {
            if ("Expense".equals(e.getType()) && e.getProjectId() != null) {
                spent.merge(e.getProjectId(), e.getAmount(), BigDecimal::add);
            }
        }
        return spent;
    }

    public ProjectDto toDto(Project p, Map<UUID, BigDecimal> spent) {
        List<TaskDto> tasks = p.getTasks().stream()
                .sorted(Comparator.comparingInt(ProjectTask::getPosition))
                .map(t -> new TaskDto(
                        t.getId().toString(), t.getTitle(), t.getStatus(),
                        t.getAssigneeId() == null ? null : t.getAssigneeId().toString(),
                        Fmt.date(t.getDueDate())))
                .toList();
        List<MilestoneDto> milestones = p.getMilestones().stream()
                .sorted(Comparator.comparingInt(ProjectMilestone::getPosition))
                .map(m -> new MilestoneDto(m.getId().toString(), m.getName(), Fmt.date(m.getDueDate()), m.getAmount(), m.isPaid()))
                .toList();
        return new ProjectDto(
                p.getId().toString(),
                p.getName(),
                p.getClientId() == null ? null : p.getClientId().toString(),
                p.getStatus(),
                p.getPriority(),
                p.getBudget(),
                spent.getOrDefault(p.getId(), BigDecimal.ZERO),
                Fmt.date(p.getStartDate()),
                Fmt.date(p.getEndDate()),
                p.getTeam().stream().map(UUID::toString).sorted().toList(),
                p.getCategory(),
                tasks,
                milestones);
    }

    @Transactional
    public void create(Member actor, ProjectRequest req) {
        Permissions.require(Permissions.editProjects(actor.getRole()), "Your role cannot create projects.");
        // The client is optional. When one is given it must exist.
        UUID clientId = Parse.optionalUuid(req.clientId(), "Client");
        if (clientId != null && !clients.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        LocalDate start = Validation.date(req.start(), "Start date");
        LocalDate end = Validation.date(req.end(), "End date");
        Validation.notBefore(end, start, "End date must be on or after the start date");

        Project p = new Project(
                UUID.randomUUID(),
                Validation.required(req.name(), "Project name"),
                clientId,
                Validation.required(req.category(), "Category"),
                "Planning",
                req.priority() == null ? "Medium" : Validation.oneOf(req.priority(), "Priority", PRIORITIES),
                Validation.positive(req.budget(), "Budget"),
                start,
                end,
                Instant.now(clock));
        p.getTeam().add(actor.getId());
        projects.save(p);
        audit.record(actor, "Created project " + p.getName());
    }

    @Transactional
    public void setStatus(Member actor, UUID id, String status) {
        Permissions.require(Permissions.editProjects(actor.getRole()), "Your role cannot change project status.");
        Project p = find(id);
        String next = Validation.oneOf(status, "Status", STATUSES);
        p.setStatus(next);
        audit.record(actor, "Set " + p.getName() + " status to " + next);
    }

    @Transactional
    public void delete(Member actor, UUID id) {
        Permissions.require(Permissions.editProjects(actor.getRole()), "Your role cannot delete projects.");
        Project p = find(id);
        orders.detachProject(id);
        ledger.detachProject(id);
        documents.detachProject(id);
        projects.delete(p);
        audit.record(actor, "Deleted project " + p.getName());
    }

    @Transactional
    public void assignMember(Member actor, UUID id, String memberId) {
        Permissions.require(Permissions.editProjects(actor.getRole()), "Your role cannot assign team members.");
        Project p = find(id);
        UUID memberUuid = Parse.uuid(memberId, "Team member");
        if (!members.namesById().containsKey(memberUuid)) {
            throw ApiException.notFound("Team member not found");
        }
        if (p.getTeam().add(memberUuid)) {
            audit.record(actor, "Assigned " + members.namesById().get(memberUuid) + " to " + p.getName());
        }
    }

    @Transactional
    public void addTask(Member actor, UUID id, TaskRequest req) {
        Project p = find(id);
        requireTaskAccess(actor, p);
        String title = Validation.required(req.title(), "Task title");
        LocalDate due = Validation.date(req.due(), "Due date");
        UUID assignee = req.assigneeId() == null || req.assigneeId().isBlank() ? null : Parse.uuid(req.assigneeId(), "Assignee");
        if (assignee != null && !p.getTeam().contains(assignee)) {
            throw ApiException.badRequest("Assignee must be on the project team");
        }
        int position = p.getTasks().stream().mapToInt(ProjectTask::getPosition).max().orElse(0) + 1;
        p.getTasks().add(new ProjectTask(UUID.randomUUID(), position, title, "Backlog", assignee, due));
    }

    @Transactional
    public void moveTask(Member actor, UUID projectId, UUID taskId, String status) {
        Project p = find(projectId);
        requireTaskAccess(actor, p);
        String next = Validation.oneOf(status, "Status", TASK_STATUSES);
        ProjectTask task = p.getTasks().stream().filter(t -> t.getId().equals(taskId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Task not found"));
        task.setStatus(next);
        audit.record(actor, "Moved task to " + next + " in " + p.getName());
    }

    @Transactional
    public void setMilestonePaid(Member actor, UUID projectId, UUID milestoneId, boolean paid) {
        Permissions.require(Permissions.editFinance(actor.getRole()), "Only finance roles can mark milestones as paid.");
        Project p = find(projectId);
        ProjectMilestone m = p.getMilestones().stream().filter(x -> x.getId().equals(milestoneId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Milestone not found"));
        if (paid && !m.isPaid()) {
            m.setPaid(true);
            audit.record(actor, "Milestone \"" + m.getName() + "\" paid");
        }
    }

    /** Developers may move and add tasks on projects they are assigned to; managers on any project. */
    private void requireTaskAccess(Member actor, Project p) {
        Role role = actor.getRole();
        boolean allowed = Permissions.editProjects(role) || (role == Role.DEVELOPER && p.getTeam().contains(actor.getId()));
        Permissions.require(allowed, "You can only update tasks on projects you are assigned to.");
    }

    public Project find(UUID id) {
        return projects.findById(id).orElseThrow(() -> ApiException.notFound("Project not found"));
    }
}
