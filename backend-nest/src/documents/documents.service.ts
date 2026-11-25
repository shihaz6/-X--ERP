import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppConfig, CONFIG } from '../config.provider';
import { Db, Queryable } from '../db/db.service';
import { Member } from '../common/member';
import { notFound, tooLarge, badRequest } from '../common/errors';
import * as V from '../common/validation';
import { todayIn, stampIn } from '../common/time';
import { humanSize } from '../common/format';
import { AuditService } from '../audit/audit.service';

export const DOCUMENT_CATEGORIES = ['Proposal', 'Agreement', 'Invoice', 'Specification', 'NDA'] as const;
export const DOCUMENT_STATUSES = ['Draft', 'In Review', 'Signed', 'Archived'] as const;

export interface UploadedFile {
  originalname?: string;
  mimetype?: string;
  size: number;
  buffer: Buffer;
}

export interface DocumentVersionDto {
  version: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string | null;
  uploadedBy: string;
}

export interface DocumentDto {
  id: string;
  name: string;
  category: string;
  clientId: string;
  projectId: string | null;
  status: string;
  version: number;
  updated: string;
  size: string;
  versions: DocumentVersionDto[];
}

interface DocumentRow {
  id: string;
  name: string;
  category: string;
  client_id: string;
  project_id: string | null;
  status: string;
  current_version: number;
  updated_on: string;
}

interface VersionRow {
  id: string;
  document_id: string;
  version: number;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_at: Date;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async list(): Promise<DocumentDto[]> {
    const [docs, versions, names] = await Promise.all([
      this.db.q.query<DocumentRow>(
        'SELECT id, name, category, client_id, project_id, status, current_version, updated_on FROM documents ORDER BY updated_on DESC, name ASC'),
      this.db.q.query<VersionRow>(
        'SELECT id, document_id, version, file_name, content_type, size_bytes, uploaded_by, uploaded_at FROM document_versions ORDER BY version DESC'),
      this.db.q.query<{ id: string; name: string }>('SELECT id, name FROM members'),
    ]);
    const nameById = new Map(names.rows.map(n => [n.id, n.name]));
    const versionsByDoc = new Map<string, VersionRow[]>();
    for (const v of versions.rows) {
      const list = versionsByDoc.get(v.document_id) ?? [];
      list.push(v);
      versionsByDoc.set(v.document_id, list);
    }

    return docs.rows.map(d => {
      const history = versionsByDoc.get(d.id) ?? [];
      const current = history.find(v => v.version === d.current_version);
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        clientId: d.client_id,
        projectId: d.project_id,
        status: d.status,
        version: d.current_version,
        updated: d.updated_on,
        size: current ? humanSize(Number(current.size_bytes)) : '—',
        versions: history.map(v => ({
          version: v.version,
          fileName: v.file_name,
          sizeBytes: Number(v.size_bytes),
          uploadedAt: stampIn(v.uploaded_at, this.config.timezone),
          uploadedBy: v.uploaded_by ? nameById.get(v.uploaded_by) ?? '—' : '—',
        })),
      };
    });
  }

  async upload(actor: Member, file: UploadedFile | undefined, body: {
    name?: string; category?: string; clientId?: string; projectId?: string;
  }): Promise<void> {
    const content = this.readValidated(file);
    const fileName = file!.originalname?.trim() ? file!.originalname : 'document';
    const docName = V.optional(body.name) ?? fileName;
    const category = V.oneOf(body.category, 'Category', DOCUMENT_CATEGORIES);
    const clientId = V.uuid(body.clientId, 'Client');
    const projectId = V.optionalUuid(body.projectId, 'Project');
    await this.db.tx(async tx => {
      if (!(await tx.query('SELECT 1 FROM clients WHERE id = $1', [clientId])).rowCount) throw notFound('Client not found');
      if (projectId && !(await tx.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rowCount) {
        throw notFound('Project not found');
      }
      const docId = randomUUID();
      await tx.query(
        `INSERT INTO documents (id, name, category, client_id, project_id, status, current_version, updated_on, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Draft', 1, $6, now())`,
        [docId, docName, category, clientId, projectId, todayIn(this.config.timezone)]);
      await this.saveVersion(tx, actor, docId, 1, fileName, file!.mimetype, content);
      await this.audit.record(tx, actor, `Uploaded ${docName}`);
    });
  }

  async uploadVersion(actor: Member, documentId: string, file: UploadedFile | undefined): Promise<void> {
    const content = this.readValidated(file);
    const fileName = file!.originalname?.trim() ? file!.originalname : 'document';
    await this.db.tx(async tx => {
      const doc = await this.find(tx, documentId, true);
      const next = doc.current_version + 1;
      await tx.query('UPDATE documents SET current_version = $1, updated_on = $2 WHERE id = $3',
        [next, todayIn(this.config.timezone), documentId]);
      await this.saveVersion(tx, actor, documentId, next, fileName, file!.mimetype, content);
      await this.audit.record(tx, actor, `Uploaded new version of ${doc.name}`);
    });
  }

  async setStatus(actor: Member, id: string, status: string | undefined): Promise<void> {
    await this.db.tx(async tx => {
      const doc = await this.find(tx, id, true);
      const next = V.oneOf(status, 'Status', DOCUMENT_STATUSES);
      await tx.query('UPDATE documents SET status = $1 WHERE id = $2', [next, id]);
      await this.audit.record(tx, actor, `Set ${doc.name} status to ${next}`);
    });
  }

  async download(documentId: string, version: number | undefined): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const doc = await this.find(this.db.q, documentId, false);
    const v = version ?? doc.current_version;
    const meta = await this.db.q.query<VersionRow>(
      'SELECT id, document_id, version, file_name, content_type, size_bytes, uploaded_by, uploaded_at FROM document_versions WHERE document_id = $1 AND version = $2',
      [documentId, v]);
    if (!meta.rows[0]) throw notFound('Version not found');
    const blob = await this.db.q.query<{ content: Buffer }>('SELECT content FROM document_blobs WHERE version_id = $1', [meta.rows[0].id]);
    if (!blob.rows[0]) throw notFound('File content is missing');
    return { fileName: meta.rows[0].file_name, contentType: meta.rows[0].content_type, content: blob.rows[0].content };
  }

  private async saveVersion(tx: Queryable, actor: Member, docId: string, version: number, fileName: string,
    contentType: string | undefined, content: Buffer): Promise<void> {
    const versionId = randomUUID();
    await tx.query(
      `INSERT INTO document_versions (id, document_id, version, file_name, content_type, size_bytes, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [versionId, docId, version, fileName, contentType?.trim() ? contentType : 'application/octet-stream', content.length, actor.id]);
    await tx.query('INSERT INTO document_blobs (version_id, content) VALUES ($1, $2)', [versionId, content]);
  }

  private readValidated(file: UploadedFile | undefined): Buffer {
    if (!file || !file.size) throw badRequest('Choose a file to upload');
    if (file.size > this.config.maxUploadBytes) throw tooLarge('File is larger than the 25 MB limit');
    return file.buffer;
  }

  async find(q: Queryable, id: string, lock: boolean): Promise<DocumentRow> {
    const r = await q.query<DocumentRow>(
      `SELECT id, name, category, client_id, project_id, status, current_version, updated_on FROM documents WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
      [id]);
    if (!r.rows[0]) throw notFound('Document not found');
    return r.rows[0];
  }
}
