import { useState } from 'react';
import { Plus, LayoutGrid, List, ArrowLeft, CalendarDays, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardHead, PageHeader, Button, Badge, Table, Modal, Field, Input, Select, money, fmtDate, useStore, Tabs, Progress, Avatar, Empty, Confirm } from './ui';
import { api } from './api';
import type { Project, Task, TaskStatus, ProjectStatus, Priority } from './types';

const COLS: TaskStatus[] = ['Backlog', 'In Progress', 'Review', 'Done'];
const SERVICES = ['Software Development', 'AI Solutions', 'Business Automation', 'Consulting', 'Enterprise Software'];
const pct = (p: Project) => (p.tasks.length ? Math.round((p.tasks.filter(t => t.status === 'Done').length / p.tasks.length) * 100) : 0);

export default function Projects() {
  const s = useStore();
  const { ws, caps } = s;
  const [view, setView] = useState<'Cards' | 'List'>('Cards');
  const [filter, setFilter] = useState('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = ws.projects.filter(p => filter === 'All' || p.status === filter);
  const cname = (id: string | null) => (id ? ws.clients.find(c => c.id === id)?.name : undefined) ?? 'No client';
  const project = openId ? ws.projects.find(p => p.id === openId) : undefined;

  if (project) return <ProjectDetail project={project} back={() => setOpenId(null)} />;

  return (
    <div>
      <PageHeader title="Projects" sub={caps.editProjects ? `${ws.projects.length} engagements across ${new Set(ws.projects.map(p => p.clientId)).size} clients` : 'Projects you are working on'} actions={<>
        <Select value={filter} onChange={e => setFilter(e.target.value)} options={['All', 'Planning', 'Active', 'On Hold', 'Completed']} className="w-36" />
        <div className="inline-flex rounded-lg border border-line bg-base p-0.5">{([['Cards', LayoutGrid], ['List', List]] as const).map(([v, I]) => <button key={v} aria-label={`${v} view`} aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-md p-1.5 ${view === v ? 'bg-raised text-white' : 'text-neutral-500'}`}><I size={15} /></button>)}</div>
        {caps.editProjects && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} />New project</Button>}
      </>} />
      {!list.length ? (
        <Card><Empty title={ws.projects.length ? 'No projects match this filter' : 'No projects yet'} text={caps.editProjects ? 'Create a project for a client engagement to start tracking tasks and milestones.' : 'Projects you are assigned to will appear here.'} action={caps.editProjects && <Button variant="primary" onClick={() => setCreating(true)}>Create project</Button>} /></Card>
      ) : view === 'Cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map(p => (
            <Card key={p.id} className="fade-up cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-neutral-500">
              <div onClick={() => setOpenId(p.id)}>
                <div className="flex items-start justify-between gap-2"><div><div className="text-[11px] uppercase tracking-wider text-neutral-500">{cname(p.clientId)}</div><div className="mt-1 font-medium">{p.name}</div></div><Badge>{p.priority}</Badge></div>
                <div className="mt-4 flex items-center justify-between text-xs text-neutral-500"><span>Progress</span><span className="text-neutral-200">{pct(p)}%</span></div>
                <div className="mt-1.5"><Progress value={pct(p)} /></div>
                {caps.finance && (
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-neutral-500">Budget</div><div className="mt-0.5 text-neutral-200">{money(p.budget, true)}</div></div>
                    <div><div className="text-neutral-500">Spent</div><div className={`mt-0.5 ${p.budget && p.spent / p.budget > 0.85 ? 'text-amber-400' : 'text-neutral-200'}`}>{money(p.spent, true)}</div></div>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-4">
                  <div className="flex -space-x-2">{p.team.map(id => <Avatar key={id} m={ws.members.find(m => m.id === id)} size={26} />)}</div>
                  <div className="flex items-center gap-2"><Badge>{p.status}</Badge><span className="flex items-center gap-1 text-xs text-neutral-500"><CalendarDays size={12} />{shortDate(p.end)}</span></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><Table rows={list} onRow={p => setOpenId(p.id)} cols={[
          { h: 'Project', r: p => <div><div className="font-medium text-neutral-100">{p.name}</div><div className="text-xs text-neutral-500">{cname(p.clientId)} · {p.category}</div></div> },
          { h: 'Status', r: p => <Badge>{p.status}</Badge> },
          { h: 'Priority', r: p => <Badge>{p.priority}</Badge> },
          { h: 'Progress', r: p => <div className="w-28"><Progress value={pct(p)} /></div> },
          { h: 'Budget', r: p => caps.finance ? money(p.budget, true) : '—' },
          { h: 'Deadline', r: p => fmtDate(p.end) },
        ]} /></Card>
      )}
      <NewProject open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

const shortDate = (d: string) => fmtDate(d).slice(0, 6);

function ProjectDetail({ project: p, back }: { project: Project; back: () => void }) {
  const s = useStore();
  const { ws, caps } = s;
  const [tab, setTab] = useState<'Board' | 'Tasks' | 'Milestones' | 'Expenses'>('Board');
  const [newTask, setNewTask] = useState({ title: '', assignee: p.team[0] ?? '', due: '' });
  const [taskErr, setTaskErr] = useState('');
  const [del, setDel] = useState(false);
  const editable = caps.editProjects;
  const canMove = caps.moveTasks;
  const moveTask = (tid: string, status: TaskStatus) => s.act(() => api.projects.moveTask(p.id, tid, status), undefined);
  const expenses = ws.transactions.filter(t => t.projectId === p.id && t.type === 'Expense');
  const client = ws.clients.find(c => c.id === p.clientId);
  const memberName = (id: string | null) => ws.members.find(m => m.id === id);

  return (
    <div className="fade-up">
      <button onClick={back} className="mb-4 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-200"><ArrowLeft size={14} />All projects</button>
      <PageHeader title={p.name} sub={`${client?.name ?? '—'} · ${p.category} · ${fmtDate(p.start)} → ${fmtDate(p.end)}`} actions={<>
        <Select disabled={!editable} value={p.status} onChange={e => s.act(() => api.projects.setStatus(p.id, e.target.value), `Status updated to ${e.target.value}`)} options={['Planning', 'Active', 'On Hold', 'Completed'] as ProjectStatus[]} className="w-36" />
        {editable && <Button variant="ghost" aria-label="Delete project" onClick={() => setDel(true)}><Trash2 size={15} /></Button>}
      </>} />
      <div className={`mb-4 grid grid-cols-2 gap-3 ${caps.finance ? 'md:grid-cols-5' : 'md:grid-cols-2'}`}>
        {[['Progress', pct(p) + '%'], ...(caps.finance ? [['Budget', money(p.budget, true)], ['Spent', money(p.spent, true)], ['Remaining', money(p.budget - p.spent, true)]] : []), ['Priority', p.priority]].map(([l, v]) => <Card key={l as string} className="px-4 py-3"><div className="text-xs text-neutral-500">{l}</div><div className="mt-1 font-display text-lg font-semibold">{v}</div></Card>)}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={['Board', 'Tasks', 'Milestones', 'Expenses']} value={tab} onChange={setTab} />
        <div className="flex items-center gap-2 text-xs text-neutral-500">Team<div className="flex -space-x-2">{p.team.map(mid => <Avatar key={mid} m={ws.members.find(m => m.id === mid)} />)}</div>
          {editable && <Select value="" onChange={e => { if (e.target.value) s.act(() => api.projects.assign(p.id, e.target.value), 'Team member assigned'); }} options={[['', '+ Assign'], ...ws.members.filter(m => !p.team.includes(m.id)).map(m => [m.id, m.name] as [string, string])]} className="h-8 w-32 text-xs" />}
        </div>
      </div>

      {(tab === 'Board' || tab === 'Tasks') && canMove && (
        <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
          <Field label="New task" error={taskErr} className="min-w-52 flex-1"><Input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="e.g. Integrate payments API" /></Field>
          <Field label="Assignee"><Select value={newTask.assignee} onChange={e => setNewTask({ ...newTask, assignee: e.target.value })} options={[['', 'Unassigned'], ...p.team.map(mid => [mid, memberName(mid)?.name ?? '—'] as [string, string])]} className="w-44" /></Field>
          <Field label="Due"><Input type="date" value={newTask.due} onChange={e => setNewTask({ ...newTask, due: e.target.value })} className="w-40" /></Field>
          <Button variant="primary" onClick={async () => {
            if (!newTask.title.trim() || !newTask.due) return setTaskErr('Title and due date are required');
            setTaskErr('');
            const ok = await s.act(() => api.projects.addTask(p.id, { title: newTask.title.trim(), assigneeId: newTask.assignee || null, due: newTask.due }), 'Task added');
            if (ok) setNewTask({ ...newTask, title: '', due: '' });
          }}><Plus size={15} />Add</Button>
        </Card>
      )}

      {tab === 'Board' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {COLS.map(col => (
            <div key={col} onDragOver={e => e.preventDefault()} onDrop={e => canMove && moveTask(e.dataTransfer.getData('t'), col)} className="min-h-40 rounded-2xl border border-line/50 bg-base/60 p-2.5">
              <div className="mb-2 flex justify-between px-1.5 text-xs"><Badge>{col}</Badge><span className="text-neutral-500">{p.tasks.filter(t => t.status === col).length}</span></div>
              <div className="space-y-2">{p.tasks.filter(t => t.status === col).map(t => (
                <div key={t.id} draggable={canMove} onDragStart={e => e.dataTransfer.setData('t', t.id)} className="cursor-grab rounded-xl border border-line/70 bg-panel p-3 transition hover:border-neutral-500 active:cursor-grabbing">
                  <div className="text-sm">{t.title}</div>
                  <div className="mt-2.5 flex items-center justify-between"><Avatar m={memberName(t.assignee)} size={22} /><span className="text-[11px] text-neutral-500">{shortDate(t.due)}</span></div>
                </div>
              ))}</div>
            </div>
          ))}
        </div>
      )}
      {tab === 'Tasks' && <Card><Table rows={p.tasks} empty={<Empty title="No tasks yet" text="Add tasks to break the project into work items." />} cols={[
        { h: 'Task', r: (t: Task) => t.title },
        { h: 'Assignee', r: (t: Task) => <div className="flex items-center gap-2"><Avatar m={memberName(t.assignee)} size={22} />{memberName(t.assignee)?.name ?? 'Unassigned'}</div> },
        { h: 'Due', r: (t: Task) => fmtDate(t.due) },
        { h: 'Status', r: (t: Task) => <Select disabled={!canMove} value={t.status} onChange={e => moveTask(t.id, e.target.value as TaskStatus)} options={COLS} className="h-8 w-36 text-xs" /> },
      ]} /></Card>}
      {tab === 'Milestones' && <Card><CardHead title="Delivery & payment milestones" sub={caps.finance ? `${money(p.milestones.filter(m => m.paid).reduce((a, b) => a + b.amount, 0))} collected of ${money(p.milestones.reduce((a, b) => a + b.amount, 0))}` : 'Delivery milestones'} />
        <div className="px-5 pb-5">{p.milestones.length ? p.milestones.map(m => (
          <div key={m.id} className="flex items-center gap-4 border-b border-line/40 py-3 last:border-0">
            {m.paid ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} className="text-neutral-600" />}
            <div className="flex-1"><div className="text-sm">{m.name}</div><div className="text-xs text-neutral-500">Due {fmtDate(m.due)}</div></div>
            {caps.finance && <span className="text-sm">{money(m.amount)}</span>}
            {!m.paid && caps.editFinance ? <Button size="sm" onClick={() => s.act(() => api.projects.setMilestonePaid(p.id, m.id, true), 'Milestone marked as paid')}>Mark paid</Button> : <Badge>{m.paid ? 'Paid' : 'Pending'}</Badge>}
          </div>
        )) : <p className="py-6 text-center text-xs text-neutral-500">No milestones defined for this project.</p>}</div></Card>}
      {tab === 'Expenses' && <Card><Table rows={expenses} empty={<Empty title="No project expenses" text="Expenses tagged to this project in Finance appear here." />} cols={[{ h: 'Date', r: t => fmtDate(t.date) }, { h: 'Description', r: t => t.desc }, { h: 'Category', r: t => t.category }, { h: 'Amount', r: t => money(t.amount), cls: 'text-right' }]} /></Card>}
      <Confirm open={del} onClose={() => setDel(false)} danger cta="Delete project" title="Delete this project?" text={`"${p.name}" and its ${p.tasks.length} tasks will be permanently removed. This cannot be undone.`} onConfirm={async () => { if (await s.act(() => api.projects.remove(p.id), 'Project deleted')) back(); }} />
    </div>
  );
}

function NewProject({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const blank = { name: '', clientId: s.ws.clients[0]?.id ?? '', category: SERVICES[0], priority: 'Medium', budget: '', start: '', end: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const u = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Project name is required';
    if (!(Number(f.budget) > 0)) e.budget = 'Enter a budget';
    if (!f.start) e.start = 'Required';
    if (!f.end) e.end = 'Required';
    else if (f.start && f.end < f.start) e.end = 'End must be after start';
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const ok = await s.act(() => api.projects.create({ name: f.name.trim(), clientId: f.clientId || null, category: f.category, priority: f.priority as Priority, budget: Number(f.budget), start: f.start, end: f.end }), 'Project created');
    setSaving(false);
    if (ok) { setF(blank); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New project" sub="Set up a new client engagement" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create project'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Project name" error={err.name} className="col-span-2"><Input value={f.name} onChange={u('name')} /></Field>
        <Field label="Client (optional)" error={err.clientId}><Select value={f.clientId} onChange={u('clientId')} options={[['', 'No client'], ...s.ws.clients.map(c => [c.id, c.name] as [string, string])]} /></Field>
        <Field label="Service category"><Select value={f.category} onChange={u('category')} options={SERVICES} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={u('priority')} options={['Low', 'Medium', 'High', 'Critical']} /></Field>
        <Field label="Budget (LKR)" error={err.budget}><Input type="number" value={f.budget} onChange={u('budget')} /></Field>
        <Field label="Start date" error={err.start}><Input type="date" value={f.start} onChange={u('start')} /></Field>
        <Field label="Target end date" error={err.end}><Input type="date" value={f.end} onChange={u('end')} /></Field>
      </div>
    </Modal>
  );
}
