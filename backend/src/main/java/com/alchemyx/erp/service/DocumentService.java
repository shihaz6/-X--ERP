package com.alchemyx.erp.service;

import com.alchemyx.erp.api.Dtos.DocumentDto;
import com.alchemyx.erp.api.Dtos.DocumentVersionDto;
import com.alchemyx.erp.auth.Permissions;
import com.alchemyx.erp.config.AppProperties;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Entities.Document;
import com.alchemyx.erp.model.Entities.DocumentBlob;
import com.alchemyx.erp.model.Entities.DocumentVersion;
import com.alchemyx.erp.model.Entities.Member;
import com.alchemyx.erp.repository.ClientRepository;
import com.alchemyx.erp.repository.DocumentBlobRepository;
import com.alchemyx.erp.repository.DocumentRepository;
import com.alchemyx.erp.repository.DocumentVersionRepository;
import com.alchemyx.erp.repository.ProjectRepository;
import com.alchemyx.erp.util.Fmt;
import com.alchemyx.erp.util.Parse;
import com.alchemyx.erp.util.Validation;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    public static final List<String> CATEGORIES = List.of("Proposal", "Agreement", "Invoice", "Specification", "NDA");
    public static final List<String> STATUSES = List.of("Draft", "In Review", "Signed", "Archived");

    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final DocumentBlobRepository blobs;
    private final ClientRepository clients;
    private final ProjectRepository projects;
    private final MemberService members;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public DocumentService(DocumentRepository documents, DocumentVersionRepository versions, DocumentBlobRepository blobs,
                           ClientRepository clients, ProjectRepository projects, MemberService members,
                           AuditService audit, AppProperties props, Clock clock) {
        this.documents = documents;
        this.versions = versions;
        this.blobs = blobs;
        this.clients = clients;
        this.projects = projects;
        this.members = members;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
    }

    /** File content for download. */
    public record Download(String fileName, String contentType, byte[] content) {}

    @Transactional(readOnly = true)
    public List<DocumentDto> list() {
        Map<UUID, String> names = members.namesById();
        return documents.findAllByOrderByUpdatedOnDescNameAsc().stream()
                .map(d -> toDto(d, names))
                .toList();
    }

    public DocumentDto toDto(Document d, Map<UUID, String> names) {
        List<DocumentVersionDto> history = versions.findByDocumentIdOrderByVersionDesc(d.getId()).stream()
                .map(v -> new DocumentVersionDto(
                        v.getVersion(),
                        v.getFileName(),
                        v.getSizeBytes(),
                        Fmt.stamp(v.getUploadedAt(), clock.getZone()),
                        v.getUploadedBy() == null ? "—" : names.getOrDefault(v.getUploadedBy(), "—")))
                .toList();
        DocumentVersion current = history.isEmpty() ? null : versions.findByDocumentIdAndVersion(d.getId(), d.getCurrentVersion()).orElse(null);
        return new DocumentDto(
                d.getId().toString(),
                d.getName(),
                d.getCategory(),
                d.getClientId().toString(),
                d.getProjectId() == null ? null : d.getProjectId().toString(),
                d.getStatus(),
                d.getCurrentVersion(),
                Fmt.date(d.getUpdatedOn()),
                current == null ? "—" : Fmt.humanSize(current.getSizeBytes()),
                history.stream().sorted(Comparator.comparingInt(DocumentVersionDto::version).reversed()).toList());
    }

    @Transactional
    public void upload(Member actor, MultipartFile file, String name, String category, String clientId, String projectId) {
        byte[] content = readValidated(file);
        String docName = Validation.optional(name) != null ? name.trim() : fileNameOf(file);
        String cat = Validation.oneOf(category, "Category", CATEGORIES);
        UUID client = Parse.uuid(clientId, "Client");
        if (!clients.existsById(client)) {
            throw ApiException.notFound("Client not found");
        }
        UUID project = Parse.optionalUuid(projectId, "Project");
        if (project != null && !projects.existsById(project)) {
            throw ApiException.notFound("Project not found");
        }
        LocalDate today = LocalDate.now(clock);
        Document doc = new Document(UUID.randomUUID(), docName, cat, client, project, today, Instant.now(clock));
        documents.save(doc);
        saveVersion(actor, doc, 1, fileNameOf(file), file.getContentType(), content);
        audit.record(actor, "Uploaded " + docName);
    }

    @Transactional
    public void uploadVersion(Member actor, UUID documentId, MultipartFile file) {
        byte[] content = readValidated(file);
        Document doc = find(documentId);
        int next = doc.getCurrentVersion() + 1;
        doc.setCurrentVersion(next);
        doc.setUpdatedOn(LocalDate.now(clock));
        saveVersion(actor, doc, next, fileNameOf(file), file.getContentType(), content);
        audit.record(actor, "Uploaded new version of " + doc.getName());
    }

    @Transactional
    public void setStatus(Member actor, UUID id, String status) {
        Document doc = find(id);
        String next = Validation.oneOf(status, "Status", STATUSES);
        doc.setStatus(next);
        audit.record(actor, "Set " + doc.getName() + " status to " + next);
    }

    @Transactional(readOnly = true)
    public Download download(Member viewer, UUID documentId, Integer version) {
        Document doc = find(documentId);
        int v = version == null ? doc.getCurrentVersion() : version;
        DocumentVersion meta = versions.findByDocumentIdAndVersion(documentId, v)
                .orElseThrow(() -> ApiException.notFound("Version not found"));
        DocumentBlob blob = blobs.findById(meta.getId())
                .orElseThrow(() -> ApiException.notFound("File content is missing"));
        return new Download(meta.getFileName(), meta.getContentType(), blob.getContent());
    }

    private void saveVersion(Member actor, Document doc, int version, String fileName, String contentType, byte[] content) {
        UUID versionId = UUID.randomUUID();
        versions.save(new DocumentVersion(
                versionId,
                doc.getId(),
                version,
                fileName,
                contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType,
                content.length,
                actor.getId(),
                Instant.now(clock)));
        blobs.save(new DocumentBlob(versionId, content));
    }

    private byte[] readValidated(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose a file to upload");
        }
        if (file.getSize() > props.maxUploadBytes()) {
            throw new ApiException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE, "File is larger than the 25 MB limit");
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("The file could not be read");
        }
    }

    private static String fileNameOf(MultipartFile file) {
        String name = file.getOriginalFilename();
        return name == null || name.isBlank() ? "document" : name;
    }

    public Document find(UUID id) {
        return documents.findById(id).orElseThrow(() -> ApiException.notFound("Document not found"));
    }
}
