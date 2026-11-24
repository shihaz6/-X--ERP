import { useEffect, useState } from 'react';
import { Plus, Download, AlertCircle, Repeat, Send, CheckCheck } from 'lucide-react';
import { Card, CardHead, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, money, fmtDate, useStore, Tabs, Empty, Donut, PALETTE, BarChart, LineChart, exportCSV, Confirm } from './ui';
import { api } from './api';
import type { FinanceAnalytics, Invoice, Txn } from './types';

const CATS = { Income: ['Client Payment', 'Subscription', 'Consulting Fee', 'Other Income'], Expense: ['Salaries', 'Cloud Infrastructure', 'Software', 'Rent', 'Marketing', 'Travel', 'Other'] } as const;
const SERVICE_LINES = ['Software Development', 'AI Solutions', 'Business Automation', 'Consulting', 'Enterprise Software'];

export default function Finance() {
  const s = useStore();
  const { ws, caps } = s;
  const [tab, setTab] = useState<'Overview' | 'Invoices' | 'Transactions' | 'P&L'>('Overview');
  const [invOpen, setInvOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [invFilter, setInvFilter] = useState('All');
  const [txFilter, setTxFilter] = useState('All');
  const [pay, setPay] = useState<Invoice | null>(null);
  const [fin, setFin] = useState<FinanceAnalytics | null>(null);
  const editable = caps.editFinance;
  const cname = (id: string) => ws.clients.find(c => c.id === id)?.name ?? '—';

  useEffect(() => { api.financeAnalytics().then(setFin).catch(() => setFin(null)); }, [ws]);

  const outstandingInvoices = ws.invoices.filter(i => ['Sent', 'Overdue'].includes(i.status));
  const overdue = ws.invoices.filter(i => i.status === 'Overdue');
  const byService = SERVICE_LINES.map((sv, i) => ({ label: sv, value: ws.orders.filter(o => o.service === sv && o.status !== 'Cancelled').reduce((a, b) => a + b.amount, 0), color: PALETTE[i] }));
  const byServiceTotal = byService.reduce((a, b) => a + b.value, 0);

  const markSent = (inv: Invoice) => s.act(() => api.invoices.setStatus(inv.id, 'Sent'), `${inv.id} sent to client`);
  const markPaid = (inv: Invoice) => s.act(() => api.invoices.setStatus(inv.id, 'Paid'), `${inv.id} marked as paid`);

  return (
    <div>
      <PageHeader title="Finance & Revenue" sub="Income, expenses, invoicing and cash flow · LKR" actions={<>
        <Tabs tabs={['Overview', 'Invoices', 'Transactions', 'P&L']} value={tab} onChange={setTab} />
        {editable && <><Button onClick={() => setTxOpen(true)}><Plus size={15} />Transaction</Button><Button variant="primary" onClick={() => setInvOpen(true)}><Plus size={15} />New invoice</Button></>}
      </>} />
      {!editable && <div className="mb-4 rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-xs text-neutral-400">View-only. Your role can see finance data but cannot record transactions or issue invoices.</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Outstanding balance', money(fin?.outstanding ?? 0, true), `${outstandingInvoices.length} invoices`],
          ['Overdue', money(fin?.overdue ?? 0, true), `${overdue.length} invoice(s)`],
          ['Recurring revenue (MRR)', money(fin?.monthlyRecurring ?? 0, true), 'from active subscriptions'],
          ['Cash position', money(fin?.cashPosition ?? 0, true), 'opening balance plus net flow'],
        ].map(([l, v, h], i) => (
          <Card key={l as string} className={`px-4 py-3 ${i === 1 && overdue.length ? 'border-red-500/30' : ''}`}><div className="flex items-center gap-1.5 text-xs text-neutral-500">{i === 1 && <AlertCircle size={12} className="text-red-400" />}{i === 2 && <Repeat size={12} />}{l}</div><div className="mt-1 font-display text-xl font-semibold">{v}</div><div className="text-[11px] text-neutral-500">{h}</div></Card>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2"><CardHead title="Cash-flow overview" sub="Cash balance at the end of each month" /><div className="px-5 pb-4">{fin && fin.cash.length ? <LineChart labels={fin.cash.map(c => c.label)} data={fin.cash.map(c => c.balance)} /> : <Empty title="No cash data yet" text="Record income and expenses to see the cash position over time." />}</div></Card>
          <Card><CardHead title="Revenue by service" sub="Booked order value (excludes cancelled)" /><div className="px-5 pb-5">{byServiceTotal ? <Donut items={byService} /> : <Empty title="No orders yet" text="Booked order value by service appears here." />}</div></Card>
          <Card className="xl:col-span-2"><CardHead title="Revenue by project" sub="Paid milestones" />
            <div className="space-y-3 px-5 pb-5">{ws.projects.length ? ws.projects.map(p => { const v = p.milestones.filter(m => m.paid).reduce((a, b) => a + b.amount, 0); const max = Math.max(...ws.projects.map(x => x.milestones.filter(m => m.paid).reduce((a, b) => a + b.amount, 0))) || 1; return (
              <div key={p.id} className="flex items-center gap-3 text-xs"><span className="w-48 truncate text-neutral-300">{p.name}</span><div className="h-2 flex-1 rounded-full bg-white/5"><div className="h-full rounded-full bg-accent" style={{ width: `${(v / max) * 100}%` }} /></div><span className="w-20 text-right text-neutral-200">{money(v, true)}</span></div>
            ); }) : <p className="text-xs text-neutral-500">No projects yet.</p>}</div></Card>
          <Card><CardHead title="Client payment history" />
            <div className="px-5 pb-5">{ws.clients.filter(c => ws.invoices.some(i => i.clientId === c.id)).map(c => { const paid = ws.invoices.filter(i => i.clientId === c.id && i.status === 'Paid').reduce((a, b) => a + b.amount, 0); const due = ws.invoices.filter(i => i.clientId === c.id && i.status !== 'Paid').reduce((a, b) => a + b.amount, 0); return (
              <div key={c.id} className="flex items-center justify-between border-b border-line/40 py-2 text-xs last:border-0"><span className="text-neutral-300">{c.name}</span><span><span className="text-emerald-400">{money(paid, true)}</span>{due > 0 && <span className="ml-2 text-amber-400">{money(due, true)} due</span>}</span></div>
            ); })}</div></Card>
        </div>
      )}

      {tab === 'Invoices' && (
        <Card>
          <CardHead title="Invoices" right={<Select value={invFilter} onChange={e => setInvFilter(e.target.value)} options={['All', 'Draft', 'Sent', 'Paid', 'Overdue']} className="h-8 w-32 text-xs" />} />
          <Table rows={ws.invoices.filter(i => invFilter === 'All' || i.status === invFilter)} empty={<Empty title="No invoices" text={ws.invoices.length ? 'No invoices with this status.' : 'Create an invoice or generate one from an order.'} />} cols={[
            { h: 'Invoice', r: i => <span className="font-mono text-xs">{i.id}</span> },
            { h: 'Client', r: i => cname(i.clientId) },
            { h: 'Order', r: i => <span className="font-mono text-xs text-neutral-500">{i.orderId ?? '—'}</span> },
            { h: 'Issued', r: i => fmtDate(i.issued) },
            { h: 'Due', r: i => <span className={i.status === 'Overdue' ? 'text-red-400' : ''}>{fmtDate(i.due)}</span> },
            { h: 'Amount', r: i => money(i.amount) },
            { h: 'Status', r: i => <Badge>{i.status}</Badge> },
            { h: '', cls: 'text-right', r: i => editable && (i.status === 'Draft' ? <Button size="sm" onClick={() => markSent(i)}><Send size={12} />Send</Button> : i.status !== 'Paid' ? <Button size="sm" onClick={() => setPay(i)}><CheckCheck size={12} />Record payment</Button> : null) },
          ]} />
        </Card>
      )}

      {tab === 'Transactions' && (
        <Card>
          <CardHead title="Income & expenses" right={<div className="flex gap-2"><Select value={txFilter} onChange={e => setTxFilter(e.target.value)} options={['All', 'Income', 'Expense']} className="h-8 w-28 text-xs" /><Button size="sm" onClick={() => { exportCSV('alchemyx-transactions', ws.transactions as unknown as Record<string, unknown>[]); s.toast('Transactions exported'); }}><Download size={13} />CSV</Button></div>} />
          <Table rows={ws.transactions.filter((t: Txn) => txFilter === 'All' || t.type === txFilter)} empty={<Empty title="No transactions" text="Income and expenses you record appear here." />} cols={[
            { h: 'Date', r: t => fmtDate(t.date) },
            { h: 'Description', r: t => t.desc },
            { h: 'Category', r: t => t.category },
            { h: 'Type', r: t => <Badge>{t.type}</Badge> },
            { h: 'Amount', cls: 'text-right', r: t => <span className={t.type === 'Income' ? 'text-emerald-400' : ''}>{t.type === 'Income' ? '+' : '−'}{money(t.amount)}</span> },
          ]} />
        </Card>
      )}

      {tab === 'P&L' && (
        <Card>
          <CardHead title="Monthly profit & loss" sub="Last 12 months, from recorded transactions" right={<Button size="sm" disabled={!fin} onClick={() => { exportCSV('alchemyx-pnl', (fin?.months ?? []).map(m => ({ month: m.label, revenue: m.revenue, expenses: m.expenses, net: m.revenue - m.expenses, margin: m.revenue ? (((m.revenue - m.expenses) / m.revenue) * 100).toFixed(1) + '%' : '—' }))); s.toast('P&L report exported'); }}><Download size={13} />Export report</Button>} />
          {fin && fin.months.length > 0 && <>
            <div className="px-5"><BarChart height={160} labels={fin.months.map(m => m.label)} series={[{ name: 'Net profit', data: fin.months.map(m => m.revenue - m.expenses), color: '#FF6A2D' }]} /></div>
            <Table rows={fin.months} cols={[
              { h: 'Month', r: x => x.label }, { h: 'Revenue', r: x => money(x.revenue) }, { h: 'Expenses', r: x => money(x.expenses) },
              { h: 'Net profit', r: x => <span className={x.revenue - x.expenses >= 0 ? 'text-emerald-400' : 'text-red-400'}>{money(x.revenue - x.expenses)}</span> },
              { h: 'Margin', cls: 'text-right', r: x => x.revenue ? (((x.revenue - x.expenses) / x.revenue) * 100).toFixed(1) + '%' : '—' },
            ]} />
          </>}
        </Card>
      )}

      <NewInvoice open={invOpen} onClose={() => setInvOpen(false)} />
      <NewTxn open={txOpen} onClose={() => setTxOpen(false)} />
      <Confirm open={!!pay} onClose={() => setPay(null)} title="Record payment" cta="Confirm payment" text={pay ? `Mark ${pay.id} (${money(pay.amount)}) from ${cname(pay.clientId)} as fully paid? An income transaction will be recorded.` : ''} onConfirm={() => pay && markPaid(pay)} />
    </div>
  );
}

function NewInvoice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const { ws } = s;
  const [f, setF] = useState({ clientId: ws.clients[0]?.id ?? '', orderId: '', desc: '', qty: '1', rate: '', due: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const total = Number(f.qty) * Number(f.rate) || 0;
  const u = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async (status: 'Draft' | 'Sent') => {
    const e: Record<string, string> = {};
    if (!f.desc.trim()) e.desc = 'Line item description is required';
    if (!(total > 0)) e.rate = 'Rate must be greater than 0';
    if (!f.due) e.due = 'Due date is required';
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await s.act(() => api.invoices.create({ clientId: f.clientId, orderId: f.orderId || null, description: f.desc.trim(), amount: total, due: f.due, status }), status === 'Sent' ? 'Invoice sent to client' : 'Invoice saved as draft');
    setSaving(false);
    if (ok) { setF({ ...f, desc: '', rate: '', due: '', orderId: '' }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} wide title="New invoice" sub="The invoice number is assigned when you save" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => save('Draft')} disabled={saving}>Save draft</Button><Button variant="primary" onClick={() => save('Sent')} disabled={saving}><Send size={14} />Send invoice</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Bill to"><Select value={f.clientId} onChange={u('clientId')} options={ws.clients.map(c => [c.id, c.name] as [string, string])} /></Field>
        <Field label="Linked order"><Select value={f.orderId} onChange={u('orderId')} options={[['', 'None'], ...ws.orders.filter(o => o.clientId === f.clientId).map(o => [o.id, `${o.id} · ${o.title}`] as [string, string])]} /></Field>
        <Field label="Line item" error={err.desc} className="col-span-2"><Input value={f.desc} onChange={u('desc')} placeholder="e.g. Milestone 2 — Model delivery" /></Field>
        <Field label="Quantity"><Input type="number" min={1} value={f.qty} onChange={u('qty')} /></Field>
        <Field label="Rate (LKR)" error={err.rate}><Input type="number" min={0} value={f.rate} onChange={u('rate')} /></Field>
        <Field label="Due date" error={err.due}><Input type="date" value={f.due} onChange={u('due')} /></Field>
        <div className="flex flex-col justify-end rounded-xl border border-accent/30 bg-accent-soft px-4 py-2"><div className="text-xs text-neutral-400">Total due</div><div className="font-display text-xl font-semibold text-accent">{money(total)}</div></div>
      </div>
    </Modal>
  );
}

function NewTxn({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const { ws } = s;
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ type: 'Expense' as 'Income' | 'Expense', desc: '', category: CATS.Expense[0] as string, amount: '', date: today, projectId: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.desc.trim() || !(Number(f.amount) > 0)) return setErr('Description and a positive amount are required');
    setErr(''); setSaving(true);
    const ok = await s.act(() => api.transactions.create({ type: f.type, description: f.desc.trim(), category: f.category, amount: Number(f.amount), date: f.date, projectId: f.projectId || null }), `${f.type} recorded`);
    setSaving(false);
    if (ok) { setF({ ...f, desc: '', amount: '' }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Record transaction" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type"><Select value={f.type} onChange={e => { const type = e.target.value as 'Income' | 'Expense'; setF({ ...f, type, category: CATS[type][0] }); }} options={['Income', 'Expense']} /></Field>
        <Field label="Category"><Select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} options={[...CATS[f.type]]} /></Field>
        <Field label="Description" className="col-span-2" error={err}><Input value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></Field>
        <Field label="Amount (LKR)"><Input type="number" min={0} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Project (optional)" className="col-span-2"><Select value={f.projectId} onChange={e => setF({ ...f, projectId: e.target.value })} options={[['', 'None'], ...ws.projects.map(p => [p.id, p.name] as [string, string])]} /></Field>
      </div>
    </Modal>
  );
}

