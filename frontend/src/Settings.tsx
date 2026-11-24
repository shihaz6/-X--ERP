import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, CardHead, PageHeader, Button, Badge, Table, Field, Input, Select, Modal, useStore, Avatar, Confirm, Logo } from './ui';
import { api } from './api';
import type { Role } from './types';

const SECTIONS = ['Company', 'Accounts & roles', 'Services', 'Invoicing', 'Notifications', 'Audit log'] as const;
type Section = (typeof SECTIONS)[number];
const ROLES: Role[] = ['Super Admin', 'Finance Manager', 'Project Manager', 'Developer'];
const CURRENCIES = ['LKR', 'USD', 'EUR'];
const FISCAL = ['July', 'January', 'April'];
const TEMPLATES = ['Modern', 'Classic', 'Minimal'];
const TERMS = ['Net 30', 'Net 15', 'Net 45', 'Due on receipt'];
// Role-to-module matrix describing what the application enforces.
const PERMS: [string, boolean[]][] = [
  ['Dashboard', [true, true, true, true]],
  ['CRM & clients', [true, false, true, false]],
  ['Projects (edit)', [true, false, true, false]],
  ['Orders', [true, true, true, false]],
  ['Finance & invoicing', [true, true, false, false]],
  ['Analytics', [true, true, false, false]],
  ['Team & timesheets', [true, false, true, true]],
  ['Settings & admin', [true, false, false, false]],
];

export default function Settings() {
  const s = useStore();
  const { ws } = s;
  const [sec, setSec] = useState<Section>('Company');
  if (!s.caps.admin) return <div className="text-sm text-neutral-500">Only a Super Admin can change workspace settings.</div>;
  return (
    <div>
      <PageHeader title="Settings & Administration" sub="Workspace configuration · Super Admin only" />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2">{SECTIONS.map(x => <button key={x} onClick={() => setSec(x)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${sec === x ? 'bg-accent-soft text-accent' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'}`}>{x}</button>)}</Card>
        <div className="fade-up" key={sec}>
          {sec === 'Company' && <CompanySection />}
          {sec === 'Accounts & roles' && <AccountsSection />}
          {sec === 'Services' && <ServicesSection services={ws.settings.services} />}
          {sec === 'Invoicing' && <InvoicingSection />}
          {sec === 'Notifications' && <NotificationsSection />}
          {sec === 'Audit log' && <Card><CardHead title="Audit log" sub="Every business change is recorded with the person who made it" />
            <Table rows={ws.audit} empty={<div className="px-5 pb-5 text-xs text-neutral-500">No activity recorded yet.</div>} cols={[{ h: 'Time', r: a => <span className="font-mono text-xs text-neutral-500">{a.at}</span> }, { h: 'User', r: a => a.who }, { h: 'Action', r: a => a.what }]} /></Card>}
        </div>
      </div>
    </div>
  );
}

function SaveBar({ onSave, busy }: { onSave: () => void; busy: boolean }) {
  return <div className="col-span-full flex justify-end"><Button variant="primary" onClick={onSave} disabled={busy}>Save changes</Button></div>;
}

function CompanySection() {
  const s = useStore();
  const { settings } = s.ws;
  const [company, setCompany] = useState({ companyName: settings.company.name, registrationNo: settings.company.registrationNo, billingEmail: settings.company.billingEmail, registeredAddress: settings.company.address });
  const [currency, setCurrency] = useState(settings.currency);
  const [fiscal, setFiscal] = useState(settings.fiscalYearStart);
  const [cash, setCash] = useState(String(settings.openingCash));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await s.act(() => api.settings.update({ ...company, currency, fiscalYearStart: fiscal, openingCash: Number(cash) || 0 }), 'Company settings saved');
    setBusy(false);
  };
  return (
    <Card><CardHead title="Company details & branding" />
      <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
        <div className="col-span-full flex items-center gap-4 rounded-xl border border-line/60 bg-base/50 p-4"><Logo size={44} /><span className="text-xs text-neutral-500">The AlchemyX logo is used on the workspace and invoices.</span></div>
        <Field label="Legal name"><Input value={company.companyName} onChange={e => setCompany({ ...company, companyName: e.target.value })} /></Field>
        <Field label="Registration no."><Input value={company.registrationNo} onChange={e => setCompany({ ...company, registrationNo: e.target.value })} /></Field>
        <Field label="Billing email"><Input value={company.billingEmail} onChange={e => setCompany({ ...company, billingEmail: e.target.value })} /></Field>
        <Field label="Registered address"><Input value={company.registeredAddress} onChange={e => setCompany({ ...company, registeredAddress: e.target.value })} /></Field>
        <Field label="Default currency"><Select value={currency} onChange={e => setCurrency(e.target.value)} options={CURRENCIES} /></Field>
        <Field label="Fiscal year start"><Select value={fiscal} onChange={e => setFiscal(e.target.value as typeof fiscal)} options={FISCAL} /></Field>
        <Field label="Opening cash balance (LKR)"><Input type="number" value={cash} onChange={e => setCash(e.target.value)} /></Field>
        <SaveBar onSave={save} busy={busy} />
      </div>
    </Card>
  );
}

function AccountsSection() {
  const s = useStore();
  const { ws } = s;
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      <Card><CardHead title="Employee accounts" sub="Each member signs in with their own email and password" right={<Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={13} />Add member</Button>} />
        <Table rows={ws.members} cols={[
          { h: 'User', r: m => <div className="flex items-center gap-2"><Avatar m={m} size={26} /><div><div>{m.name}</div><div className="text-xs text-neutral-500">{m.email}</div></div></div> },
          { h: 'Access role', r: m => <Select value={m.access} disabled={m.id === ws.me.id} onChange={e => s.act(() => api.members.update(m.id, { access: e.target.value }), `${m.name} is now ${e.target.value}`)} options={ROLES} className="h-8 w-40 text-xs" /> },
          { h: 'Status', r: m => <Badge tone={m.status === 'On Leave' ? 'amber' : 'green'}>{m.status}</Badge> },
        ]} />
      </Card>
      <Card><CardHead title="Role-based access control" sub="Module access per role, as enforced by the server" />
        <Table rows={PERMS} cols={[{ h: 'Module', r: p => p[0] }, ...ROLES.map((r, i) => ({ h: r, cls: 'text-center', r: (p: [string, boolean[]]) => (p[1][i] ? <span className="text-accent">●</span> : <span className="text-neutral-700">—</span>) }))]} /></Card>
      <AddMemberModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const blank = { name: '', username: '', email: '', password: '', access: 'Developer' as Role, jobTitle: '', department: '', capacityHours: '40' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const u = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!/^[a-z0-9._-]{3,40}$/i.test(f.username)) e.username = '3-40 characters: letters, digits, . _ -';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email address';
    if (f.password.length < 8) e.password = 'At least 8 characters';
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await s.act(() => api.members.create({ name: f.name.trim(), username: f.username.trim().toLowerCase(), email: f.email.trim(), password: f.password, access: f.access, jobTitle: f.jobTitle.trim(), department: f.department.trim(), capacityHours: Number(f.capacityHours) || 40 }), `${f.name} added`);
    setSaving(false);
    if (ok) { setF(blank); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add team member" sub="Share the initial password with the person securely" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Adding…' : 'Add member'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" error={err.name}><Input value={f.name} onChange={u('name')} /></Field>
        <Field label="Username" error={err.username}><Input value={f.username} onChange={u('username')} placeholder="e.g. shanika.f" /></Field>
        <Field label="Work email" error={err.email}><Input type="email" value={f.email} onChange={u('email')} /></Field>
        <Field label="Initial password" error={err.password} className="col-span-2"><Input type="password" value={f.password} onChange={u('password')} /></Field>
        <Field label="Access role"><Select value={f.access} onChange={u('access')} options={ROLES} /></Field>
        <Field label="Capacity (hours / week)"><Input type="number" min={0} max={168} value={f.capacityHours} onChange={u('capacityHours')} /></Field>
        <Field label="Job title"><Input value={f.jobTitle} onChange={u('jobTitle')} /></Field>
        <Field label="Department"><Input value={f.department} onChange={u('department')} /></Field>
      </div>
    </Modal>
  );
}

function ServicesSection({ services }: { services: string[] }) {
  const s = useStore();
  const [newSvc, setNewSvc] = useState('');
  const [rm, setRm] = useState<string | null>(null);
  const save = (next: string[]) => s.act(() => api.settings.services(next), 'Service categories saved');
  return (
    <Card><CardHead title="Business service categories" sub="Used when creating orders and reporting service performance" />
      <div className="px-5 pb-5">
        <div className="mb-4 flex flex-wrap gap-2">{services.map(x => <span key={x} className="inline-flex items-center gap-2 rounded-full border border-line bg-base px-3 py-1.5 text-sm">{x}<button onClick={() => setRm(x)} className="text-neutral-500 hover:text-red-400" aria-label={`Remove ${x}`}><X size={13} /></button></span>)}</div>
        <div className="flex gap-2">
          <Input value={newSvc} onChange={e => setNewSvc(e.target.value)} placeholder="New category name" className="max-w-xs" />
          <Button disabled={!newSvc.trim() || services.includes(newSvc.trim())} onClick={async () => { const ok = await save([...services, newSvc.trim()]); if (ok) setNewSvc(''); }}>Add</Button>
        </div>
      </div>
      <Confirm open={!!rm} onClose={() => setRm(null)} danger cta="Remove" title="Remove category?" text={`"${rm}" will no longer be available for new orders. Existing orders are unaffected.`} onConfirm={() => rm && save(services.filter(x => x !== rm))} />
    </Card>
  );
}

function InvoicingSection() {
  const s = useStore();
  const { invoicing } = s.ws.settings;
  const [prefix, setPrefix] = useState(invoicing.prefix);
  const [next, setNext] = useState(String(invoicing.nextNumber));
  const [tpl, setTpl] = useState(invoicing.template);
  const [terms, setTerms] = useState(invoicing.paymentTerms);
  const [tax, setTax] = useState(invoicing.taxLabel);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await s.act(() => api.settings.update({ invoicePrefix: prefix, invoiceNextNumber: Number(next) || 1, invoiceTemplate: tpl, paymentTerms: terms, taxLabel: tax }), 'Invoicing settings saved');
    setBusy(false);
  };
  const year = new Date().getFullYear();
  return (
    <Card><CardHead title="Invoice numbering & templates" />
      <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
        <Field label="Number prefix"><Input value={prefix} onChange={e => setPrefix(e.target.value)} /></Field>
        <Field label="Next number"><Input value={next} onChange={e => setNext(e.target.value.replace(/\D/g, ''))} /></Field>
        <div className="col-span-full text-xs text-neutral-500">Next invoice: <span className="font-mono text-neutral-200">{prefix.replace('{YYYY}', String(year))}{String(Number(next) || 1).padStart(4, '0')}</span></div>
        <div className="col-span-full grid grid-cols-3 gap-3">{TEMPLATES.map(t => <button key={t} onClick={() => setTpl(t)} className={`rounded-xl border p-3 text-left transition ${tpl === t ? 'border-accent bg-accent-soft' : 'border-line hover:border-neutral-500'}`}><div className="mb-2 h-16 rounded-md bg-neutral-200/90 p-2"><div className={`h-1.5 w-8 rounded ${t === 'Modern' ? 'bg-accent' : 'bg-neutral-500'}`} /><div className="mt-2 h-1 w-full rounded bg-neutral-400" /><div className="mt-1 h-1 w-2/3 rounded bg-neutral-400" /></div><span className="text-sm">{t}</span></button>)}</div>
        <Field label="Default payment terms"><Select value={terms} onChange={e => setTerms(e.target.value)} options={TERMS} /></Field>
        <Field label="Tax label"><Input value={tax} onChange={e => setTax(e.target.value)} placeholder="e.g. VAT 18% or No tax" /></Field>
        <SaveBar onSave={save} busy={busy} />
      </div>
    </Card>
  );
}

function NotificationsSection() {
  const s = useStore();
  const n = s.ws.settings.notifications;
  const rows: [keyof typeof n, string, string][] = [
    ['overdue', 'Overdue invoice alerts', 'Notify finance when an invoice passes its due date'],
    ['newOrder', 'New order submitted', 'Notify admins when an order is created'],
    ['leave', 'Leave requests', 'Notify managers of pending requests'],
    ['deadline', 'Milestone deadlines', '7 days before a milestone is due'],
    ['weekly', 'Weekly executive digest', 'Monday summary email to founders'],
  ];
  return (
    <Card><CardHead title="Company notification preferences" />
      <div className="px-5 pb-5">{rows.map(([k, l, d]) => (
        <div key={k} className="flex items-center justify-between border-b border-line/40 py-3 last:border-0"><div><div className="text-sm">{l}</div><div className="text-xs text-neutral-500">{d}</div></div>
          <button onClick={() => s.act(() => api.settings.update({ [`notify${k.charAt(0).toUpperCase()}${k.slice(1)}`]: !n[k] }))} className={`relative h-5 w-9 rounded-full transition ${n[k] ? 'bg-accent' : 'bg-neutral-600'}`} aria-pressed={n[k]}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${n[k] ? 'left-[18px]' : 'left-0.5'}`} /></button></div>
      ))}</div></Card>
  );
}
