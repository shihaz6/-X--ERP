package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.OrderDto;
import com.alchemyx.erp.api.Dtos.OrderRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.Project;
import com.alchemyx.erp.model.ServiceOrder;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.ProjectRepository;
import com.alchemyx.erp.repository.ServiceCategoryRepository;
import com.alchemyx.erp.repository.ServiceOrderRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    public static final List<String> STATUSES =
            List.of("Pending", "Approved", "In Progress", "Delivered", "Completed", "Cancelled");

    private final ServiceOrderRepository orders;
    private final ClientRepository clients;
    private final ProjectRepository projects;
    private final ServiceCategoryRepository categories;
    private final AuditService audit;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public OrderService(ServiceOrderRepository orders, ClientRepository clients, ProjectRepository projects,
                        ServiceCategoryRepository categories, AuditService audit, JdbcTemplate jdbc, Clock clock) {
        this.orders = orders;
        this.clients = clients;
        this.projects = projects;
        this.categories = categories;
        this.audit = audit;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<OrderDto> list(Member viewer) {
        Permissions.require(Permissions.orders(viewer.getRole()), "Your role cannot view orders.");
        return orders.findAllByOrderByIdDesc().stream().map(this::toDto).toList();
    }

    public OrderDto toDto(ServiceOrder o) {
        return new OrderDto(
                o.getId(),
                o.getTitle(),
                o.getClientId().toString(),
                o.getProjectId() == null ? null : o.getProjectId().toString(),
                o.getService(),
                o.getAmount(),
                o.getStatus(),
                Fmt.date(o.getCreatedOn()),
                Fmt.date(o.getDeliveryDate()),
                o.getSpec());
    }

    @Transactional
    public void create(Member actor, OrderRequest req) {
        Permissions.require(Permissions.orders(actor.getRole()), "Your role cannot create orders.");
        UUID clientId = Parse.uuid(req.clientId(), "Client");
        if (!clients.existsById(clientId)) {
            throw ApiException.notFound("Client not found");
        }
        UUID projectId = Parse.optionalUuid(req.projectId(), "Project");
        if (projectId != null) {
            Project p = projects.findById(projectId).orElseThrow(() -> ApiException.notFound("Project not found"));
            if (!p.getClientId().equals(clientId)) {
                throw ApiException.badRequest("The project belongs to a different client");
            }
        }
        Set<String> allowedServices = categories.findAll().stream()
                .map(c -> c.getName()).collect(Collectors.toSet());
        String service = Validation.oneOf(req.service(), "Service", allowedServices);
        LocalDate delivery = Validation.date(req.delivery(), "Delivery date");

        Long seq = jdbc.queryForObject("select nextval('order_seq')", Long.class);
        String id = "ORD-" + seq;
        ServiceOrder o = new ServiceOrder(
                id,
                Validation.required(req.title(), "Order title"),
                clientId,
                projectId,
                service,
                Validation.positive(req.amount(), "Price"),
                "Pending",
                LocalDate.now(clock),
                delivery,
                req.spec() == null || req.spec().isBlank() ? "—" : req.spec().trim(),
                Instant.now(clock));
        orders.save(o);
        audit.record(actor, "Created order " + id);
    }

    @Transactional
    public void setStatus(Member actor, String id, String status) {
        Permissions.require(Permissions.orders(actor.getRole()), "Your role cannot change orders.");
        ServiceOrder o = orders.findById(id).orElseThrow(() -> ApiException.notFound("Order not found"));
        if ("Cancelled".equals(o.getStatus())) {
            throw ApiException.conflict("A cancelled order cannot be changed");
        }
        String next = Validation.oneOf(status, "Status", STATUSES);
        o.setStatus(next);
        audit.record(actor, "Set " + id + " status to " + next);
    }

    public ServiceOrder find(String id) {
        return orders.findById(id).orElseThrow(() -> ApiException.notFound("Order not found"));
    }
}
