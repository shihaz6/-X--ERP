import { useState } from 'react';
import { Plus, Search, Link2, FileText } from 'lucide-react';
import { Card, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, Textarea, money, fmtDate, useStore, Empty, Confirm } from './ui';
import { api } from './api';
import type { Order, OrderStatus } from './types';

const STATUSES: OrderStatus[] = ['Pending', 'Approved', 'In Progress', 'Delivered', 'Completed', 'Cancelled'];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { Pending: 'Approved', Approved: 'In Progress', 'In Progress': 'Delivered', Delivered: 'Completed' };

export default function Orders() {
  const s = useStore();
  const { ws, caps } = s;
  const [status, setStatus] = useState<'All' | OrderStatus>('All');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editable = caps.orders;
  const cname = (id: string) => ws.clients.find(c => c.id === id)?.name ?? '—';
  const list = ws.orders.filter(o => (status === 'All' || o.status === status) && (o.id + o.title + cname(o.clientId)).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Orders & Services" sub="Client orders for software, AI, automation and consulting" actions={<>
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search orders…" className="w-56 pl-8" /></div>
        {editable && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} />New order</Button>}
      </>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['All', ...STATUSES] as const).map(st => (
          <button key={st} onClick={() => setStatus(st)} className={`rounded-full border px-3 py-1 text-xs transition ${status === st ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line text-neutral-400 hover:text-neutral-200'}`}>
            {st} <span className="ml-1 text-neutral-500">{st === 'All' ? ws.orders.length : ws.orders.filter(o => o.status === st).length}</span>
          </button>
        ))}
      </div>
      <Card>
        <Table rows={list} onRow={o => setOpenId(o.id)} empty={<Empty title={ws.orders.length ? 'No orders match' : 'No orders yet'} text={ws.orders.length ? 'No orders match the current filters.' : 'Create the first client order to start delivery and invoicing.'} />} cols={[
          { h: 'Order', r: o => <div><div className="font-mono text-xs text-neutral-500">{o.id}</div><div className="font-medium text-neutral-100">{o.title}</div></div> },
          { h: 'Client', r: o => cname(o.clientId) },
          { h: 'Service', r: o => o.service },
          { h: 'Amount', r: o => money(o.amount) },
          { h: 'Delivery', r: o => fmtDate(o.delivery) },
          { h: 'Status', r: o => <Badge>{o.status}</Badge> },
        ]} />
      </Card>
      {openId && ws.orders.find(o => o.id === openId) && <OrderDetail id={openId} onClose={() => setOpenId(null)} editable={editable} />}
      <NewOrder open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function OrderDetail({ id, onClose, editable }: { id: string; onClose: () => void; editable: boolean }) {
  const s = useStore();
  const { ws, caps } = s;
  const o = ws.orders.find(x => x.id === id)!;
  const [cancel, setCancel] = useState(false);
  const inv = ws.invoices.filter(i => i.orderId === id);
  const proj = ws.projects.find(p => p.id === o.projectId);
  const setSt = (st: OrderStatus) => s.act(() => api.orders.setStatus(o.id, st), `${o.id} → ${st}`);

  return (
    <Modal open onClose={onClose} wide title={o.title} sub={`${o.id} · ${ws.clients.find(c => c.id === o.clientId)?.name ?? '—'}`} footer={editable && <>
      {!['Cancelled', 'Completed'].includes(o.status) && <Button variant="ghost" onClick={() => setCancel(true)}>Cancel order</Button>}
      {caps.editFinance && <Button onClick={() => s.act(() => api.orders.invoice(o.id), 'Draft invoice created')}><FileText size={14} />Generate invoice</Button>}
      {NEXT[o.status] && <Button variant="primary" onClick={() => setSt(NEXT[o.status]!)}>Mark as {NEXT[o.status]}</Button>}
    </>}>
      <div className="mb-5 flex items-center gap-1">
        {STATUSES.slice(0, 5).map((st, i) => {
          const reached = STATUSES.indexOf(o.status) >= i && o.status !== 'Cancelled';
          return <div key={st} className="flex-1"><div className={`h-1 rounded-full ${reached ? 'bg-accent' : 'bg-white/10'}`} /><div className={`mt-1.5 text-[11px] ${reached ? 'text-neutral-200' : 'text-neutral-600'}`}>{st}</div></div>;
        })}
      </div>
      {o.status === 'Cancelled' && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">This order was cancelled.</div>}
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        {[['Service', o.service], ['Price', money(o.amount)], ['Created', fmtDate(o.created)], ['Delivery', fmtDate(o.delivery)]].map(([l, v]) => <div key={l}><div className="text-xs text-neutral-500">{l}</div><div className="mt-0.5">{v}</div></div>)}
      </div>
      <div className="mt-5"><div className="mb-1 text-xs text-neutral-500">Specification & requirements</div><p className="whitespace-pre-line rounded-xl border border-line/60 bg-base/50 p-3 text-sm text-neutral-300">{o.spec}</p></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line/60 p-3"><div className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500"><Link2 size={12} />Linked project</div>{proj ? <div className="flex items-center justify-between text-sm">{proj.name}<Badge>{proj.status}</Badge></div> : <div className="text-xs text-neutral-600">Not linked</div>}</div>
        <div className="rounded-xl border border-line/60 p-3"><div className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500"><Link2 size={12} />Invoices & payments</div>{inv.length ? inv.map(i => <div key={i.id} className="flex items-center justify-between py-0.5 text-sm"><span className="font-mono text-xs">{i.id}</span><Badge>{i.status}</Badge></div>) : <div className="text-xs text-neutral-600">{caps.finance ? 'No invoices yet' : 'Visible to finance roles'}</div>}</div>
      </div>
      <Confirm open={cancel} onClose={() => setCancel(false)} danger cta="Cancel order" title={`Cancel ${o.id}?`} text="The order will be marked cancelled. Linked invoices are not changed." onConfirm={() => setSt('Cancelled')} />
    </Modal>
  );
}

function NewOrder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const { ws } = s;
  const blank = { title: '', clientId: ws.clients[0]?.id ?? '', projectId: '', service: ws.settings.services[0] ?? '', amount: '', delivery: '', spec: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const u = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = 'Order title is required';
    if (!(Number(f.amount) > 0)) e.amount = 'Enter a price';
    if (!f.delivery) e.delivery = 'Delivery date is required';
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await s.act(() => api.orders.create({ title: f.title.trim(), clientId: f.clientId, projectId: f.projectId || null, service: f.service, amount: Number(f.amount), delivery: f.delivery, spec: f.spec }), 'Order created');
    setSaving(false);
    if (ok) { setF(blank); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New order" sub="Capture a client service order" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create order'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Order title" error={err.title} className="col-span-2"><Input value={f.title} onChange={u('title')} /></Field>
        <Field label="Client"><Select value={f.clientId} onChange={u('clientId')} options={ws.clients.map(c => [c.id, c.name] as [string, string])} /></Field>
        <Field label="Link to project"><Select value={f.projectId} onChange={u('projectId')} options={[['', 'None'], ...ws.projects.filter(p => !p.clientId || p.clientId === f.clientId).map(p => [p.id, p.name] as [string, string])]} /></Field>
        <Field label="Service"><Select value={f.service} onChange={u('service')} options={ws.settings.services} /></Field>
        <Field label="Price (LKR)" error={err.amount}><Input type="number" value={f.amount} onChange={u('amount')} /></Field>
        <Field label="Delivery date" error={err.delivery} className="col-span-2"><Input type="date" value={f.delivery} onChange={u('delivery')} /></Field>
        <Field label="Specifications & requirements" className="col-span-2"><Textarea value={f.spec} onChange={u('spec')} /></Field>
      </div>
    </Modal>
  );
}
