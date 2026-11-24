import { useState } from 'react';
import { Plus, Search, Building2, Mail, Phone, MapPin, Bell, MessageSquare } from 'lucide-react';
import { Card, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, Textarea, money, fmtDate, useStore, Tabs, Empty } from './ui';
import { api } from './api';
import type { Client, Stage } from './types';

const STAGES: Stage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const INDUSTRIES = ['Technology', 'Banking', 'Retail', 'Healthcare', 'Logistics', 'Telecommunications', 'Hospitality', 'Insurance', 'Agriculture'];

export default function CRM() {
  const s = useStore();
  const { ws, caps } = s;
  const [view, setView] = useState<'Pipeline' | 'Directory'>('Pipeline');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editable = caps.editCrm;
  const list = ws.clients.filter(c => (c.name + c.contact + c.industry).toLowerCase().includes(q.toLowerCase()));
  const open = openId ? ws.clients.find(c => c.id === openId) ?? null : null;
  const openValue = ws.clients.filter(c => !['Won', 'Lost'].includes(c.stage)).reduce((a, b) => a + b.value, 0);
  const closed = ws.clients.filter(c => ['Won', 'Lost'].includes(c.stage));
  const weekAhead = new Date(`${ws.today}T00:00:00`);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekIso = weekAhead.toISOString().slice(0, 10);

  const moveStage = (c: Client, stage: Stage) => {
    if (c.stage === stage) return;
    s.act(() => api.clients.update(c.id, { stage }), `${c.name} → ${stage}`);
  };

  return (
    <div>
      <PageHeader title="Clients & CRM" sub={`${ws.clients.length} organisations · ${money(openValue, true)} open pipeline`} actions={<>
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" className="w-56 pl-8" /></div>
        <Tabs tabs={['Pipeline', 'Directory']} value={view} onChange={setView} />
        {editable && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} />New client</Button>}
      </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Follow-ups due in 7 days', ws.clients.filter(c => c.followUp && c.followUp >= ws.today && c.followUp <= weekIso).length],
          ['Open deals', ws.clients.length - closed.length],
          ['Won clients', ws.clients.filter(c => c.stage === 'Won').length],
          ['Win rate', closed.length ? `${Math.round((ws.clients.filter(c => c.stage === 'Won').length / closed.length) * 100)}%` : '—'],
        ].map(([l, v]) => (
          <Card key={l as string} className="px-4 py-3"><div className="text-xs text-neutral-500">{l}</div><div className="mt-1 font-display text-xl font-semibold">{v}</div></Card>
        ))}
      </div>

      {!ws.clients.length ? (
        <Card><Empty title="No clients yet" text="Add your first organisation to start the pipeline." action={editable && <Button variant="primary" onClick={() => setCreating(true)}>New client</Button>} /></Card>
      ) : view === 'Pipeline' ? (
        <div className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-3 overflow-x-auto pb-2">
          {STAGES.map(st => {
            const items = list.filter(c => c.stage === st);
            return (
              <div key={st} onDragOver={e => e.preventDefault()} onDrop={e => { const c = ws.clients.find(x => x.id === e.dataTransfer.getData('id')); if (c && editable) moveStage(c, st); }} className="rounded-2xl border border-line/50 bg-base/60 p-2.5">
                <div className="mb-2 flex items-center justify-between px-1.5"><Badge>{st}</Badge><span className="text-[11px] text-neutral-500">{money(items.reduce((a, b) => a + b.value, 0), true)}</span></div>
                <div className="space-y-2">
                  {items.map(c => (
                    <div key={c.id} draggable={editable} onDragStart={e => e.dataTransfer.setData('id', c.id)} onClick={() => setOpenId(c.id)} className="fade-up cursor-pointer rounded-xl border border-line/70 bg-panel p-3 transition hover:-translate-y-0.5 hover:border-neutral-500">
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">{c.industry}{caps.crm ? ` · ${c.contact}` : ''}</div>
                      <div className="mt-3 flex items-center justify-between text-xs">{caps.crm ? <span className="font-medium text-neutral-200">{money(c.value, true)}</span> : <span />}{c.followUp && <span className="flex items-center gap-1 text-neutral-500"><Bell size={11} />{shortDate(c.followUp)}</span>}</div>
                    </div>
                  ))}
                  {!items.length && <div className="rounded-xl border border-dashed border-line/60 py-6 text-center text-[11px] text-neutral-600">Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table rows={list} onRow={c => setOpenId(c.id)} empty={<Empty title="No clients match" text="Try a different search term." />} cols={[
            { h: 'Organisation', r: c => <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-neutral-400"><Building2 size={15} /></span><div><div className="font-medium text-neutral-100">{c.name}</div><div className="text-xs text-neutral-500">{c.industry}</div></div></div> },
            { h: 'Contact', r: c => caps.crm ? <div><div>{c.contact}</div><div className="text-xs text-neutral-500">{c.email}</div></div> : <span className="text-neutral-600">Restricted</span> },
            { h: 'Stage', r: c => <Badge>{c.stage}</Badge> },
            { h: 'Value', r: c => caps.crm ? money(c.value, true) : '—' },
            { h: 'Owner', r: c => c.owner },
            { h: 'Follow-up', r: c => fmtDate(c.followUp) },
          ]} />
        </Card>
      )}

      {open && <ClientDrawer c={open} onClose={() => setOpenId(null)} onStage={moveStage} editable={editable} />}
      <NewClient open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

const shortDate = (d: string) => fmtDate(d).slice(0, 6);

function ClientDrawer({ c, onClose, onStage, editable }: { c: Client; onClose: () => void; onStage: (c: Client, s: Stage) => void; editable: boolean }) {
  const s = useStore();
  const [note, setNote] = useState('');
  const [type, setType] = useState('Meeting');
  const projects = s.ws.projects.filter(p => p.clientId === c.id);
  const orders = s.ws.orders.filter(o => o.clientId === c.id);
  const docs = s.ws.documents.filter(d => d.clientId === c.id);
  const addNote = async () => {
    if (!note.trim()) return;
    const ok = await s.act(() => api.clients.addNote(c.id, { type, text: note.trim() }), 'Activity logged');
    if (ok) setNote('');
  };
  return (
    <Modal open onClose={onClose} title={c.name} sub={`${c.industry} · client since ${fmtDate(c.since)}`} wide>
      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-4 md:col-span-2">
          <div className="space-y-2.5 rounded-xl border border-line/60 bg-base/50 p-4 text-sm">
            <div className="font-medium">{c.contact || 'No contact recorded'}</div>
            {c.email && <div className="flex items-center gap-2 text-neutral-400"><Mail size={13} />{c.email}</div>}
            {c.phone && <div className="flex items-center gap-2 text-neutral-400"><Phone size={13} />{c.phone}</div>}
            {c.city && <div className="flex items-center gap-2 text-neutral-400"><MapPin size={13} />{c.city}</div>}
          </div>
          <Field label="Pipeline stage"><Select disabled={!editable} value={c.stage} onChange={e => onStage(c, e.target.value as Stage)} options={STAGES} /></Field>
          <Field label="Next follow-up"><Input type="date" disabled={!editable} value={c.followUp ?? ''} onChange={e => s.act(() => api.clients.update(c.id, { followUp: e.target.value }), 'Reminder scheduled')} /></Field>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[['Projects', projects.length], ['Orders', orders.length], ['Docs', docs.length]].map(([l, v]) => <div key={l} className="rounded-lg bg-white/[0.03] py-2"><div className="text-base font-semibold">{v}</div><div className="text-neutral-500">{l}</div></div>)}
          </div>
          {docs.length > 0 && <div><div className="mb-2 text-xs font-medium text-neutral-400">Proposals & contracts</div>{docs.map(d => <div key={d.id} className="flex items-center justify-between py-1.5 text-xs"><span className="truncate pr-2 text-neutral-300">{d.name}</span><Badge>{d.status}</Badge></div>)}</div>}
        </div>
        <div className="md:col-span-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-400"><MessageSquare size={13} />Communication history & meeting notes</div>
          {editable && (
            <div className="mb-4 rounded-xl border border-line/60 bg-base/50 p-3">
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Log a call, email or meeting note…" className="border-0 bg-transparent px-0 focus:ring-0" />
              <div className="flex items-center justify-between"><Select value={type} onChange={e => setType(e.target.value)} options={['Meeting', 'Call', 'Email']} className="h-8 w-28 text-xs" /><Button size="sm" variant="primary" onClick={addNote} disabled={!note.trim()}>Log activity</Button></div>
            </div>
          )}
          <div className="space-y-3 border-l border-line/70 pl-4">
            {c.notes.length ? c.notes.map((n, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-accent" />
                <div className="text-xs text-neutral-500">{n.type} · {fmtDate(n.date)}</div>
                <p className="mt-0.5 text-sm text-neutral-300">{n.text}</p>
              </div>
            )) : <p className="text-xs text-neutral-500">No activity logged yet.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function NewClient({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const blank = { name: '', industry: 'Technology', contact: '', email: '', phone: '', city: '', value: '', stage: 'Lead', followUp: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Organisation name is required';
    if (!f.contact.trim()) e.contact = 'Primary contact is required';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email address';
    if (!(Number(f.value) >= 0) || f.value === '') e.value = 'Enter the estimated deal value';
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await s.act(() => api.clients.create({ ...f, value: Number(f.value), followUp: f.followUp || null }), `${f.name} added to CRM`);
    setSaving(false);
    if (ok) { setF(blank); onClose(); }
  };
  const u = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} onClose={onClose} title="New client" sub="Add an organisation to your CRM" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create client'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Organisation name" error={err.name} className="col-span-2"><Input value={f.name} onChange={u('name')} placeholder="e.g. Ceylon Freight Lines" /></Field>
        <Field label="Industry"><Select value={f.industry} onChange={u('industry')} options={INDUSTRIES} /></Field>
        <Field label="Stage"><Select value={f.stage} onChange={u('stage')} options={STAGES} /></Field>
        <Field label="Primary contact" error={err.contact}><Input value={f.contact} onChange={u('contact')} /></Field>
        <Field label="Email" error={err.email}><Input value={f.email} onChange={u('email')} placeholder="name@company.com" /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={u('phone')} placeholder="+94 …" /></Field>
        <Field label="City"><Input value={f.city} onChange={u('city')} /></Field>
        <Field label="Next follow-up (optional)"><Input type="date" value={f.followUp} onChange={u('followUp')} /></Field>
        <Field label="Estimated deal value (LKR)" error={err.value} className="col-span-2"><Input type="number" min={0} value={f.value} onChange={u('value')} /></Field>
      </div>
    </Modal>
  );
}
