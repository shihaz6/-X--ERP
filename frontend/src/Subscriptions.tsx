import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHead, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, money, fmtDate, useStore, Empty } from './ui';
import { api } from './api';
import type { Subscription } from './types';

/** Recurring client subscriptions: bill them monthly, pause, resume or cancel. Finance roles only. */
export default function Subscriptions() {
  const s = useStore();
  const { ws, caps } = s;
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [open, setOpen] = useState(false);
  const editable = caps.editFinance;

  useEffect(() => {
    api.subscriptions.list().then(setSubs).catch(() => setSubs([]));
  }, [ws]);

  const active = subs.filter(x => x.status === 'Active');
  const monthly = active.reduce((a, b) => a + b.monthlyAmount, 0);

  const billDue = async () => {
    try {
      const r = await api.subscriptions.billDue();
      s.toast(r.invoices ? `${r.invoices} invoice(s) drafted` : 'Nothing due for billing');
      await s.refresh();
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Billing failed', 'warn');
    }
  };

  return (
    <div>
      <PageHeader title="Subscriptions" sub={`${active.length} active · ${money(monthly)} monthly recurring`} actions={editable && <>
        <Button onClick={billDue}>Bill due subscriptions</Button>
        <Button variant="primary" onClick={() => setOpen(true)}><Plus size={15} />New subscription</Button>
      </>} />
      <Card>
        <CardHead title="All subscriptions" sub="Each billing run drafts an invoice for the next month and moves the billing date forward" />
        <Table rows={subs} empty={<Empty title="No subscriptions yet" text="Add a client subscription to bill a monthly fee." />} cols={[
          { h: 'Client', r: x => x.clientName },
          { h: 'Plan', r: x => x.plan },
          { h: 'Monthly', r: x => money(x.monthlyAmount) },
          { h: 'Next billing', r: x => fmtDate(x.nextBilling) },
          { h: 'Status', r: x => <Badge>{x.status}</Badge> },
          { h: '', cls: 'text-right', r: x => editable && x.status !== 'Cancelled' && (
            <div className="flex justify-end gap-1">
              {x.status === 'Active' && <Button size="sm" onClick={() => s.act(() => api.subscriptions.bill(x.id), 'Invoice drafted for next month')}>Bill now</Button>}
              <Button size="sm" variant="ghost" onClick={() => s.act(() => api.subscriptions.setStatus(x.id, x.status === 'Active' ? 'Paused' : 'Active'), x.status === 'Active' ? 'Subscription paused' : 'Subscription resumed')}>{x.status === 'Active' ? 'Pause' : 'Resume'}</Button>
              <Button size="sm" variant="ghost" onClick={() => s.act(() => api.subscriptions.setStatus(x.id, 'Cancelled'), 'Subscription cancelled')}>Cancel</Button>
            </div>) },
        ]} />
      </Card>
      <NewSubscription open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewSubscription({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const { ws } = s;
  const [f, setF] = useState({ clientId: ws.clients[0]?.id ?? '', plan: '', monthlyAmount: '', start: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.clientId) e.clientId = 'Add a client first';
    if (!f.plan.trim()) e.plan = 'Plan name is required';
    if (!(Number(f.monthlyAmount) > 0)) e.monthlyAmount = 'Enter a monthly amount greater than 0';
    if (!f.start) e.start = 'Start date is required';
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await s.act(() => api.subscriptions.create({ clientId: f.clientId, plan: f.plan.trim(), monthlyAmount: Number(f.monthlyAmount), start: f.start }), 'Subscription added');
    setSaving(false);
    if (ok) { setF({ ...f, plan: '', monthlyAmount: '' }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New subscription" sub="The first invoice is drafted when you bill it" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add subscription'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Client" error={err.clientId} className="col-span-2"><Select value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })} options={ws.clients.map(c => [c.id, c.name] as [string, string])} /></Field>
        <Field label="Plan" error={err.plan} className="col-span-2"><Input value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })} placeholder="e.g. Managed support — Standard" /></Field>
        <Field label="Monthly amount (LKR)" error={err.monthlyAmount}><Input type="number" min={0} value={f.monthlyAmount} onChange={e => setF({ ...f, monthlyAmount: e.target.value })} /></Field>
        <Field label="Start date" error={err.start}><Input type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
