import { useState } from 'react';
import { Plus, Clock, Mail } from 'lucide-react';
import { Card, CardHead, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, fmtDate, useStore, Tabs, Avatar, Progress, Empty } from './ui';
import { api } from './api';
import type { Leave, Member } from './types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Unpaid'];

/** Dates Monday to Friday of the workspace week, as YYYY-MM-DD. */
function weekDays(weekStart: string): string[] {
  const start = new Date(`${weekStart}T00:00:00`);
  return DAY_NAMES.map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

export default function Team() {
  const s = useStore();
  const { ws, caps } = s;
  const [tab, setTab] = useState<'Members' | 'Workload' | 'Timesheets' | 'Leave'>('Members');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const assigned = (id: string) => ws.projects.filter(p => p.team.includes(id) && p.status !== 'Completed');
  const days = weekDays(ws.weekStart);
  const hoursOf = (memberId: string, date: string) => ws.timesheet.find(t => t.memberId === memberId && t.date === date)?.hours ?? 0;
  const timesheetRows = ws.members.filter(m => caps.manager || m.id === ws.me.id);
  const onLeaveNow = ws.members.filter(m => m.status === 'On Leave').length;

  const decide = (l: Leave, status: 'Approved' | 'Rejected') => s.act(() => api.leave.decide(l.id, status), `Leave ${status.toLowerCase()}`);

  return (
    <div>
      <PageHeader title="Team" sub={`${ws.members.length} people · ${onLeaveNow} on leave today`} actions={<>
        <Tabs tabs={['Members', 'Workload', 'Timesheets', 'Leave']} value={tab} onChange={setTab} />
        <Button variant="primary" onClick={() => setLeaveOpen(true)}><Plus size={15} />Request leave</Button>
      </>} />

      {tab === 'Members' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ws.members.map(m => (
            <Card key={m.id} className="fade-up p-5">
              <div className="flex items-start justify-between"><Avatar m={m} size={44} /><Badge>{m.status}</Badge></div>
              <div className="mt-3 font-medium">{m.name}</div>
              <div className="text-xs text-neutral-500">{m.role || 'No job title'}{m.dept ? ` · ${m.dept}` : ''}</div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500"><Mail size={12} />{m.email}</div>
              <div className="mt-4 border-t border-line/60 pt-3 text-xs">
                <div className="mb-1.5 text-neutral-500">Assignments</div>
                <div className="flex flex-wrap gap-1">{assigned(m.id).length ? assigned(m.id).map(p => <span key={p.id} className="rounded-md bg-white/5 px-2 py-0.5 text-neutral-300">{p.name}</span>) : <span className="text-neutral-600">None</span>}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'Workload' && (
        <Card><CardHead title="Workload overview" sub={`Logged hours this week vs capacity`} />
          <div className="space-y-4 px-5 pb-5">{ws.members.map(m => { const u = m.capacity ? (m.hours / m.capacity) * 100 : 0; return (
            <div key={m.id} className="flex items-center gap-4">
              <Avatar m={m} /><div className="w-48"><div className="text-sm">{m.name}</div><div className="text-xs text-neutral-500">{assigned(m.id).length} active projects</div></div>
              <div className="flex-1"><Progress value={u} warn={u > 100} /></div>
              <span className={`w-24 text-right text-xs ${u > 100 ? 'text-red-400' : 'text-neutral-400'}`}>{m.hours}h · {Math.round(u)}%</span>
            </div>
          ); })}</div></Card>
      )}

      {tab === 'Timesheets' && (
        <Card>
          <CardHead title={`Timesheet · week of ${fmtDate(ws.weekStart)}`} sub={caps.manager ? 'Edit hours inline; each change is saved when you leave the field' : 'Log your own hours; each change is saved when you leave the field'} right={<Button size="sm" variant="primary" onClick={async () => { try { await api.timesheets.submit(ws.weekStart); s.toast('Timesheet submitted for approval'); } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not submit', 'warn'); } }}><Clock size={13} />Submit week</Button>} />
          <TimesheetGrid rows={timesheetRows} days={days} hoursOf={hoursOf} editable />
        </Card>
      )}

      {tab === 'Leave' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2"><CardHead title="Leave requests" />
            <Table rows={ws.leaves} empty={<Empty title="No leave requests" text="Leave requests from your team appear here." />} cols={[
              { h: 'Member', r: l => { const m = ws.members.find(x => x.id === l.memberId); return <div className="flex items-center gap-2"><Avatar m={m} size={24} />{m?.name ?? '—'}</div>; } },
              { h: 'Type', r: l => l.type }, { h: 'From', r: l => fmtDate(l.from) }, { h: 'To', r: l => fmtDate(l.to) },
              { h: 'Status', r: l => <Badge>{l.status}</Badge> },
              { h: '', cls: 'text-right', r: l => caps.manager && l.status === 'Pending' && <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => decide(l, 'Rejected')}>Reject</Button><Button size="sm" onClick={() => decide(l, 'Approved')}>Approve</Button></div> },
            ]} /></Card>
          <Card><CardHead title="Availability" sub="Today" />
            <div className="space-y-2 px-5 pb-5">{ws.members.map(m => <div key={m.id} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><Avatar m={m} size={24} />{m.name}</div><Badge>{m.status}</Badge></div>)}</div></Card>
        </div>
      )}
      <LeaveModal open={leaveOpen} onClose={() => setLeaveOpen(false)} />
    </div>
  );
}

/** Editable Monday-to-Friday hours. Each field saves itself on blur when the value changed. */
function TimesheetGrid({ rows, days, hoursOf, editable }: { rows: Member[]; days: string[]; hoursOf: (m: string, d: string) => number; editable: boolean }) {
  const s = useStore();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = (m: string, d: string) => `${m}|${d}`;
  const save = async (memberId: string, date: string) => {
    const k = key(memberId, date);
    const raw = draft[k];
    if (raw === undefined) return;
    const hours = Math.max(0, Math.min(16, Math.round(Number(raw) || 0)));
    setDraft(d => { const next = { ...d }; delete next[k]; return next; });
    if (hours === hoursOf(memberId, date)) return;
    try {
      await api.timesheets.save(s.ws.weekStart, [{ memberId, date, hours }]);
      await s.refresh();
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Could not save hours', 'warn');
    }
  };
  if (!rows.length) return <Empty title="No team members" text="Add team members in Settings to start logging hours." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line/70 text-left text-[11px] uppercase tracking-wider text-neutral-500"><th className="px-5 py-3 font-medium">Member</th>{DAY_NAMES.map(d => <th key={d} className="px-5 py-3 font-medium">{d}</th>)}<th className="px-5 py-3 text-right font-medium">Total</th></tr></thead>
        <tbody>
          {rows.map(m => {
            const total = days.reduce((a, d) => a + (draft[key(m.id, d)] !== undefined ? Number(draft[key(m.id, d)]) || 0 : hoursOf(m.id, d)), 0);
            return (
              <tr key={m.id} className="border-b border-line/40 last:border-0">
                <td className="px-5 py-3"><div className="flex items-center gap-2"><Avatar m={m} size={24} />{m.name}</div></td>
                {days.map(d => (
                  <td key={d} className="px-5 py-3">
                    <input type="number" min={0} max={16} disabled={!editable}
                      value={draft[key(m.id, d)] ?? hoursOf(m.id, d)}
                      onChange={e => setDraft(x => ({ ...x, [key(m.id, d)]: e.target.value }))}
                      onBlur={() => save(m.id, d)}
                      className="h-8 w-14 rounded-md border border-line bg-base px-2 text-center text-sm outline-none focus:border-accent/70 disabled:opacity-60" />
                  </td>
                ))}
                <td className="px-5 py-3 text-right font-medium">{total}h</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeaveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState({ type: 'Annual', from: '', to: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.from || !f.to) return setErr('Select both dates');
    if (f.to < f.from) return setErr('End date must be on or after start date');
    setErr(''); setSaving(true);
    const ok = await s.act(() => api.leave.request(f), 'Leave request submitted');
    setSaving(false);
    if (ok) { setF({ type: 'Annual', from: '', to: '' }); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Request leave" sub={`For ${s.user.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>Submit request</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Leave type" className="col-span-2"><Select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} options={LEAVE_TYPES} /></Field>
        <Field label="From"><Input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To" error={err}><Input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
