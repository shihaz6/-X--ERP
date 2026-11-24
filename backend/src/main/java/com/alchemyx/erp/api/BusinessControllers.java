package com.alchemyx.erp.api;

import com.alchemyx.erp.api.Dtos.ClientDto;
import com.alchemyx.erp.api.Dtos.ClientNoteRequest;
import com.alchemyx.erp.api.Dtos.ClientRequest;
import com.alchemyx.erp.api.Dtos.DocumentDto;
import com.alchemyx.erp.api.Dtos.DocumentStatusRequest;
import com.alchemyx.erp.api.Dtos.InvoiceDto;
import com.alchemyx.erp.api.Dtos.InvoiceRequest;
import com.alchemyx.erp.api.Dtos.LeaveDecisionRequest;
import com.alchemyx.erp.api.Dtos.LeaveDto;
import com.alchemyx.erp.api.Dtos.LeaveRequest;
import com.alchemyx.erp.api.Dtos.LedgerDto;
import com.alchemyx.erp.api.Dtos.LedgerRequest;
import com.alchemyx.erp.api.Dtos.MemberCreateRequest;
import com.alchemyx.erp.api.Dtos.MemberDto;
import com.alchemyx.erp.api.Dtos.MemberUpdateRequest;
import com.alchemyx.erp.api.Dtos.MilestonePaidRequest;
import com.alchemyx.erp.api.Dtos.OrderDto;
import com.alchemyx.erp.api.Dtos.OrderRequest;
import com.alchemyx.erp.api.Dtos.ProjectDto;
import com.alchemyx.erp.api.Dtos.ProjectRequest;
import com.alchemyx.erp.api.Dtos.ServicesRequest;
import com.alchemyx.erp.api.Dtos.SettingsDto;
import com.alchemyx.erp.api.Dtos.SettingsRequest;
import com.alchemyx.erp.api.Dtos.StatusRequest;
import com.alchemyx.erp.api.Dtos.TaskRequest;
import com.alchemyx.erp.api.Dtos.TaskStatusRequest;
import com.alchemyx.erp.api.Dtos.TeamAssignRequest;
import com.alchemyx.erp.api.Dtos.TimesheetEntryDto;
import com.alchemyx.erp.api.Dtos.TimesheetRequest;
import com.alchemyx.erp.api.Dtos.TimesheetSubmitRequest;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.service.ClientService;
import com.alchemyx.erp.service.DocumentService;
import com.alchemyx.erp.service.InvoiceService;
import com.alchemyx.erp.service.LedgerService;
import com.alchemyx.erp.service.MemberService;
import com.alchemyx.erp.service.OrderService;
import com.alchemyx.erp.service.ProjectService;
import com.alchemyx.erp.service.SettingsService;
import com.alchemyx.erp.service.SubscriptionService;
import com.alchemyx.erp.api.Dtos.BillDueResponse;
import com.alchemyx.erp.api.Dtos.SubscriptionDto;
import com.alchemyx.erp.api.Dtos.SubscriptionRequest;
import com.alchemyx.erp.service.TeamService;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Thin HTTP layer. Each handler forwards the signed-in member to a service, which applies the
 * role rules and validation. Mutations return 204 (or the created record) and the UI re-reads
 * the workspace.
 */
public final class BusinessControllers {

    private BusinessControllers() {}

    @RestController
    @RequestMapping("/api/members")
    public static class Members {
        private final MemberService members;

        public Members(MemberService members) {
            this.members = members;
        }

        @GetMapping
        public List<MemberDto> list() {
            return members.list();
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public MemberDto create(Member me, @RequestBody MemberCreateRequest req) {
            return members.create(me, req);
        }

        @PatchMapping("/{id}")
        public MemberDto update(Member me, @PathVariable UUID id, @RequestBody MemberUpdateRequest req) {
            return members.update(me, id, req);
        }
    }

    @RestController
    @RequestMapping("/api/clients")
    public static class Clients {
        private final ClientService clients;

        public Clients(ClientService clients) {
            this.clients = clients;
        }

        @GetMapping
        public List<ClientDto> list(Member me) {
            return clients.list(me);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public void create(Member me, @RequestBody ClientRequest req) {
            clients.create(me, req);
        }

        @PatchMapping("/{id}")
        public void update(Member me, @PathVariable UUID id, @RequestBody ClientRequest req) {
            clients.update(me, id, req);
        }

        @PostMapping("/{id}/notes")
        @ResponseStatus(HttpStatus.CREATED)
        public void addNote(Member me, @PathVariable UUID id, @RequestBody ClientNoteRequest req) {
            clients.addNote(me, id, req);
        }
    }

    @RestController
    @RequestMapping("/api/projects")
    public static class Projects {
        private final ProjectService projects;

        public Projects(ProjectService projects) {
            this.projects = projects;
        }

        @GetMapping
        public List<ProjectDto> list(Member me) {
            return projects.list(me);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public void create(Member me, @RequestBody ProjectRequest req) {
            projects.create(me, req);
        }

        @PatchMapping("/{id}")
        public void setStatus(Member me, @PathVariable UUID id, @RequestBody StatusRequest req) {
            projects.setStatus(me, id, req.status());
        }

        @DeleteMapping("/{id}")
        public void delete(Member me, @PathVariable UUID id) {
            projects.delete(me, id);
        }

        @PostMapping("/{id}/team")
        public void assign(Member me, @PathVariable UUID id, @RequestBody TeamAssignRequest req) {
            projects.assignMember(me, id, req.memberId());
        }

        @PostMapping("/{id}/tasks")
        @ResponseStatus(HttpStatus.CREATED)
        public void addTask(Member me, @PathVariable UUID id, @RequestBody TaskRequest req) {
            projects.addTask(me, id, req);
        }

        @PatchMapping("/{id}/tasks/{taskId}")
        public void moveTask(Member me, @PathVariable UUID id, @PathVariable UUID taskId, @RequestBody TaskStatusRequest req) {
            projects.moveTask(me, id, taskId, req.status());
        }

        @PatchMapping("/{id}/milestones/{milestoneId}")
        public void milestone(Member me, @PathVariable UUID id, @PathVariable UUID milestoneId,
                              @RequestBody MilestonePaidRequest req) {
            projects.setMilestonePaid(me, id, milestoneId, req.paid());
        }
    }

    @RestController
    @RequestMapping("/api/orders")
    public static class Orders {
        private final OrderService orders;
        private final InvoiceService invoices;

        public Orders(OrderService orders, InvoiceService invoices) {
            this.orders = orders;
            this.invoices = invoices;
        }

        @GetMapping
        public List<OrderDto> list(Member me) {
            return orders.list(me);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public void create(Member me, @RequestBody OrderRequest req) {
            orders.create(me, req);
        }

        @PatchMapping("/{id}")
        public void setStatus(Member me, @PathVariable String id, @RequestBody StatusRequest req) {
            orders.setStatus(me, id, req.status());
        }

        @PostMapping("/{id}/invoice")
        @ResponseStatus(HttpStatus.CREATED)
        public void invoice(Member me, @PathVariable String id) {
            invoices.createFromOrder(me, id);
        }
    }

    @RestController
    @RequestMapping("/api/invoices")
    public static class Invoices {
        private final InvoiceService invoices;

        public Invoices(InvoiceService invoices) {
            this.invoices = invoices;
        }

        @GetMapping
        public List<InvoiceDto> list(Member me) {
            return invoices.list(me);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public void create(Member me, @RequestBody InvoiceRequest req) {
            invoices.create(me, req);
        }

        @PatchMapping("/{id}")
        public void setStatus(Member me, @PathVariable String id, @RequestBody StatusRequest req) {
            invoices.setStatus(me, id, req.status());
        }
    }

    @RestController
    @RequestMapping("/api/subscriptions")
    public static class Subscriptions {
        private final SubscriptionService subscriptions;

        public Subscriptions(SubscriptionService subscriptions) {
            this.subscriptions = subscriptions;
        }

        @GetMapping
        public List<SubscriptionDto> list(Member me) {
            return subscriptions.list(me);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public void create(Member me, @RequestBody SubscriptionRequest req) {
            subscriptions.create(me, req);
        }

        @PatchMapping("/{id}")
        public void setStatus(Member me, @PathVariable UUID id, @RequestBody StatusRequest req) {
            subscriptions.setStatus(me, id, req.status());
        }

        @PostMapping("/{id}/bill")
        @ResponseStatus(HttpStatus.CREATED)
        public void bill(Member me, @PathVariable UUID id) {
            subscriptions.bill(me, id);
        }

        @PostMapping("/bill-due")
        public BillDueResponse billDue(Member me) {
            return new BillDueResponse(subscriptions.billDue(me));
        }
    }

    @RestController
    @RequestMapping("/api/transactions")
    public static class Transactions {
        private final LedgerService ledger;

        public Transactions(LedgerService ledger) {
            this.ledger = ledger;
        }

        @GetMapping
        public List<LedgerDto> list(Member me) {
            return ledger.list(me);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        public void create(Member me, @RequestBody LedgerRequest req) {
            ledger.create(me, req);
        }
    }

    @RestController
    @RequestMapping("/api")
    public static class Team {
        private final TeamService team;

        public Team(TeamService team) {
            this.team = team;
        }

        @GetMapping("/timesheets")
        public List<TimesheetEntryDto> timesheets(Member me, @RequestParam String weekStart) {
            return team.timesheet(me, Parse.monday(Validation.date(weekStart, "Week start")));
        }

        @PutMapping("/timesheets")
        public void saveTimesheets(Member me, @RequestBody TimesheetRequest req) {
            team.saveTimesheet(me, req);
        }

        @PostMapping("/timesheets/submit")
        public void submit(Member me, @RequestBody TimesheetSubmitRequest req) {
            team.submitTimesheet(me, req.weekStart());
        }

        @GetMapping("/leave")
        public List<LeaveDto> leave() {
            return team.leaves();
        }

        @PostMapping("/leave")
        @ResponseStatus(HttpStatus.CREATED)
        public void requestLeave(Member me, @RequestBody LeaveRequest req) {
            team.requestLeave(me, req);
        }

        @PatchMapping("/leave/{id}")
        public void decideLeave(Member me, @PathVariable UUID id, @RequestBody LeaveDecisionRequest req) {
            team.decideLeave(me, id, req.status());
        }
    }

    @RestController
    @RequestMapping("/api/documents")
    public static class Documents {
        private final DocumentService documents;

        public Documents(DocumentService documents) {
            this.documents = documents;
        }

        @GetMapping
        public List<DocumentDto> list() {
            return documents.list();
        }

        @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @ResponseStatus(HttpStatus.CREATED)
        public void upload(Member me,
                           @RequestPart("file") MultipartFile file,
                           @RequestParam(required = false) String name,
                           @RequestParam String category,
                           @RequestParam String clientId,
                           @RequestParam(required = false) String projectId) {
            documents.upload(me, file, name, category, clientId, projectId);
        }

        @PostMapping(value = "/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @ResponseStatus(HttpStatus.CREATED)
        public void newVersion(Member me, @PathVariable UUID id, @RequestPart("file") MultipartFile file) {
            documents.uploadVersion(me, id, file);
        }

        @PatchMapping("/{id}")
        public void setStatus(Member me, @PathVariable UUID id, @RequestBody DocumentStatusRequest req) {
            documents.setStatus(me, id, req.status());
        }

        @GetMapping("/{id}/download")
        public ResponseEntity<byte[]> download(Member me, @PathVariable UUID id,
                                               @RequestParam(required = false) Integer version) {
            DocumentService.Download file = documents.download(me, id, version);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(file.contentType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            ContentDisposition.attachment().filename(file.fileName()).build().toString())
                    .body(file.content());
        }
    }

    @RestController
    @RequestMapping("/api/settings")
    public static class Settings {
        private final SettingsService settings;

        public Settings(SettingsService settings) {
            this.settings = settings;
        }

        @GetMapping
        public SettingsDto get() {
            return settings.get();
        }

        @PatchMapping
        public void update(Member me, @RequestBody SettingsRequest req) {
            settings.update(me, req);
        }

        @PutMapping("/services")
        public void services(Member me, @RequestBody ServicesRequest req) {
            settings.replaceServices(me, req.services());
        }
    }
}
