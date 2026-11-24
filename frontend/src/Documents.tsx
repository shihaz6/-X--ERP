import { useState } from 'react';
import { Upload, Search, FileText, FileSignature, Receipt, FileCode, Lock, History, Download } from 'lucide-react';
import { Card, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, fmtDate, useStore, Empty, Spinner } from './ui';
import { api, ApiError } from './api';
import type { Doc, DocCategory, DocStatus } from './types';

const CATS: DocCategory[] = ['Proposal', 'Agreement', 'Invoice', 'Specification', 'NDA'];
const STATUSES: DocStatus[] = ['Draft', 'In Review', 'Signed', 'Archived'];
const ICON = { Proposal: FileText, Agreement: FileSignature, Invoice: Receipt, Specification: FileCode, NDA: Lock };

export default function Documents() {
  const s = useStore();
  const { ws } = s;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [client, setClient] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const cname = (id: string) => ws.clients.find(c => c.id === id)?.name ?? '—';
  const list = ws.documents.filter(d => (cat === 'All' || d.category === cat) && (client === 'All' || d.clientId === client) && d.name.toLowerCase().includes(q.toLowerCase()));
  const open = openId ? ws.documents.find(d => d.id === openId) ?? null : null;

  return (
    <div>
      <PageHeader title="Contracts & Documents" sub={`${ws.documents.length} files · proposals, agreements, invoices and specs`} actions={<Button variant="primary" onClick={() => setUpload(true)}><Upload size={15} />Upload</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {CATS.map(c => { const I = ICON[c]; return (
          <button key={c} onClick={() => setCat(cat === c ? 'All' : c)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${cat === c ? 'border-accent/50 bg-accent-soft' : 'border-line/70 bg-panel hover:border-neutral-500'}`}>
            <I size={18} className={cat === c ? 'text-accent' : 'text-neutral-500'} /><div><div className="text-sm">{c}s</div><div className="text-xs text-neutral-500">{ws.documents.filter(d => d.category === c).length} files</div></div>
          </button>
        ); })}
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line/60 p-4">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" className="pl-8" /></div>
          <Select value={client} onChange={e => setClient(e.target.value)} options={[['All', 'All clients'], ...ws.clients.map(c => [c.id, c.name] as [string, string])]} className="w-52" />
        </div>
        <Table rows={list} onRow={d => setOpenId(d.id)} empty={<Empty title={ws.documents.length ? 'No documents found' : 'No documents yet'} text={ws.documents.length ? 'Try clearing filters or upload a new document.' : 'Upload proposals, agreements and specifications to keep them with the client record.'} />} cols={[
          { h: 'Document', r: d => { const I = ICON[d.category]; return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-neutral-400"><I size={15} /></span><div><div className="text-neutral-100">{d.name}</div><div className="text-xs text-neutral-500">{d.category} · {d.size}</div></div></div>; } },
          { h: 'Client', r: d => cname(d.clientId) },
          { h: 'Project', r: d => ws.projects.find(p => p.id === d.projectId)?.name ?? '—' },
          { h: 'Version', r: d => `v${d.version}` },
          { h: 'Updated', r: d => fmtDate(d.updated) },
          { h: 'Status', r: d => <Badge>{d.status}</Badge> },
        ]} />
      </Card>
      {open && <DocumentDetail doc={open} clientName={cname(open.clientId)} onClose={() => setOpenId(null)} />}
      <UploadModal open={upload} onClose={() => setUpload(false)} />
    </div>
  );
}

function DocumentDetail({ doc, clientName, onClose }: { doc: Doc; clientName: string; onClose: () => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const versionInput = (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    s.act(() => api.documents.newVersion(doc.id, file), `Version ${doc.version + 1} uploaded`).finally(() => setBusy(false));
  };
  const download = async (version?: number) => {
    try {
      await api.documents.download(doc.id, doc.name, version);
    } catch (e) {
      s.toast(e instanceof ApiError ? e.message : 'Download failed', 'warn');
    }
  };
  return (
    <Modal open onClose={onClose} title={doc.name} sub={`${doc.category} · ${clientName}`} footer={<>
      <Select value={doc.status} onChange={e => s.act(() => api.documents.setStatus(doc.id, e.target.value), 'Document status updated')} options={STATUSES} className="w-36" />
      <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised/60 px-4 text-sm text-neutral-200 hover:border-neutral-500 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        {busy ? <Spinner /> : <Upload size={14} />}New version
        <input type="file" className="hidden" onChange={e => versionInput(e.target.files?.[0])} />
      </label>
      <Button variant="primary" onClick={() => download()}><Download size={14} />Download</Button>
    </>}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-400"><History size={13} />Version history</div>
      <div className="space-y-2">{doc.versions.map(v => (
        <div key={v.version} className="flex items-center justify-between gap-3 rounded-lg border border-line/60 px-3 py-2 text-sm">
          <span>v{v.version} {v.version === doc.version && <span className="ml-2 text-xs text-accent">current</span>}<span className="ml-2 text-xs text-neutral-500">{v.fileName}</span></span>
          <span className="flex items-center gap-3 text-xs text-neutral-500">{v.uploadedAt} · {v.uploadedBy}<button onClick={() => download(v.version)} className="text-accent hover:underline">Download</button></span>
        </div>
      ))}
      {!doc.versions.length && <p className="text-xs text-neutral-500">No file has been uploaded for this document.</p>}</div>
    </Modal>
  );
}

function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const { ws } = s;
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ name: '', category: 'Proposal' as DocCategory, clientId: ws.clients[0]?.id ?? '', projectId: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!file) return setErr('Choose a file to upload');
    if (!f.clientId) return setErr('Add a client first');
    if (file.size > 25 * 1024 * 1024) return setErr('File is larger than 25 MB');
    setErr(''); setBusy(true);
    const form = new FormData();
    form.append('file', file);
    if (f.name.trim()) form.append('name', f.name.trim());
    form.append('category', f.category);
    form.append('clientId', f.clientId);
    if (f.projectId) form.append('projectId', f.projectId);
    const ok = await s.act(() => api.documents.upload(form), 'Document uploaded');
    setBusy(false);
    if (ok) { setFile(null); setF({ ...f, name: '' }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Upload document" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy}>{busy ? <><Spinner />Uploading…</> : 'Upload'}</Button></>}>
      <label className="mb-4 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-line py-8 text-center transition hover:border-accent/60">
        <Upload size={20} className="mb-2 text-neutral-500" />
        <span className="text-sm">{file ? file.name : 'Click to choose a file'}</span>
        <span className="text-xs text-neutral-500">{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'Up to 25 MB'}</span>
        <input type="file" className="hidden" onChange={e => { const x = e.target.files?.[0] ?? null; setFile(x); if (x && !f.name) setF(v => ({ ...v, name: x.name })); }} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        {err && <div className="col-span-2 text-xs text-red-400">{err}</div>}
        <Field label="Document name" className="col-span-2"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Defaults to the file name" /></Field>
        <Field label="Category"><Select value={f.category} onChange={e => setF({ ...f, category: e.target.value as DocCategory })} options={CATS} /></Field>
        <Field label="Client"><Select value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value, projectId: '' })} options={ws.clients.map(c => [c.id, c.name] as [string, string])} /></Field>
        <Field label="Project" className="col-span-2"><Select value={f.projectId} onChange={e => setF({ ...f, projectId: e.target.value })} options={[['', 'None'], ...ws.projects.filter(p => p.clientId === f.clientId).map(p => [p.id, p.name] as [string, string])]} /></Field>
      </div>
    </Modal>
  );
}
