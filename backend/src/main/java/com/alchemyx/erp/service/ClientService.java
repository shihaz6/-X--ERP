package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.ClientDto;
import com.alchemyx.erp.api.Dtos.ClientNoteDto;
import com.alchemyx.erp.api.Dtos.ClientNoteRequest;
import com.alchemyx.erp.api.Dtos.ClientRequest;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Entities.Client;
import com.alchemyx.erp.model.Entities.ClientNote;
import com.alchemyx.erp.model.Entities.Member;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClientService {

    public static final List<String> STAGES = List.of("Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost");
    private static final List<String> NOTE_TYPES = List.of("Meeting", "Call", "Email");

    private final ClientRepository clients;
    private final MemberService members;
    private final AuditService audit;
    private final Clock clock;

    public ClientService(ClientRepository clients, MemberService members, AuditService audit, Clock clock) {
        this.clients = clients;
        this.members = members;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ClientDto> list(Member viewer) {
        boolean crm = Permissions.crm(viewer.getRole());
        Map<UUID, String> names = members.namesById();
        return clients.findAllByOrderByNameAsc().stream().map(c -> toDto(c, names, crm)).toList();
    }

    /** Non-CRM roles get the client name and industry only, never deal value, notes or contact details. */
    public ClientDto toDto(Client c, Map<UUID, String> names, boolean crm) {
        List<ClientNoteDto> notes = crm
                ? c.getNotes().stream().map(n -> new ClientNoteDto(Fmt.date(n.getNoteDate()), n.getType(), n.getText())).toList()
                : List.of();
        return new ClientDto(
                c.getId().toString(),
                c.getName(),
                c.getIndustry(),
                crm ? c.getContact() : "",
                crm ? c.getEmail() : "",
                crm ? c.getPhone() : "",
                c.getCity(),
                c.getStage(),
                crm ? c.getValue() : BigDecimal.ZERO,
                crm && c.getOwnerId() != null ? names.getOrDefault(c.getOwnerId(), "—") : "—",
                Fmt.date(c.getFollowUp()),
                Fmt.date(c.getSince()),
                notes);
    }

    @Transactional
    public void create(Member actor, ClientRequest req) {
        Permissions.require(Permissions.editCrm(actor.getRole()), "Your role cannot add clients.");
        String stage = req.stage() == null ? "Lead" : Validation.oneOf(req.stage(), "Stage", STAGES);
        Client c = new Client(
                UUID.randomUUID(),
                Validation.required(req.name(), "Organisation name"),
                req.industry() == null || req.industry().isBlank() ? "Technology" : req.industry().trim(),
                Validation.required(req.contact(), "Primary contact"),
                Validation.email(req.email()),
                blankToEmpty(req.phone()),
                blankToEmpty(req.city()),
                stage,
                req.value() == null ? BigDecimal.ZERO : Validation.nonNegative(req.value(), "Deal value"),
                actor.getId(),
                LocalDate.now(clock),
                Instant.now(clock));
        c.setFollowUp(Validation.optionalDate(req.followUp(), "Follow-up date"));
        clients.save(c);
        audit.record(actor, "Created client " + c.getName());
    }

    @Transactional
    public void update(Member actor, UUID id, ClientRequest req) {
        Permissions.require(Permissions.editCrm(actor.getRole()), "Your role cannot edit clients.");
        Client c = find(id);
        if (req.stage() != null && !req.stage().equals(c.getStage())) {
            String stage = Validation.oneOf(req.stage(), "Stage", STAGES);
            c.setStage(stage);
            audit.record(actor, "Moved " + c.getName() + " to " + stage);
        }
        if (req.name() != null) c.setName(Validation.required(req.name(), "Organisation name"));
        if (req.industry() != null) c.setIndustry(req.industry().trim());
        if (req.contact() != null) c.setContact(Validation.required(req.contact(), "Primary contact"));
        if (req.email() != null) c.setEmail(Validation.email(req.email()));
        if (req.phone() != null) c.setPhone(req.phone().trim());
        if (req.city() != null) c.setCity(req.city().trim());
        if (req.value() != null) c.setValue(Validation.nonNegative(req.value(), "Deal value"));
        if (req.followUp() != null) c.setFollowUp(Validation.optionalDate(req.followUp(), "Follow-up date"));
    }

    @Transactional
    public void addNote(Member actor, UUID id, ClientNoteRequest req) {
        Permissions.require(Permissions.editCrm(actor.getRole()), "Your role cannot log activity.");
        Client c = find(id);
        String type = Validation.oneOf(req.type(), "Activity type", NOTE_TYPES);
        String text = Validation.required(req.text(), "Note");
        c.getNotes().add(new ClientNote(UUID.randomUUID(), LocalDate.now(clock), type, text, actor.getId(), Instant.now(clock)));
        audit.record(actor, "Logged " + type.toLowerCase() + " with " + c.getName());
    }

    public Client find(UUID id) {
        return clients.findById(id).orElseThrow(() -> ApiException.notFound("Client not found"));
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
