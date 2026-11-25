import { useEffect, useState } from 'react';
import { Wallet, TrendingDown, PiggyBank, Receipt, FolderKanban, ArrowUpRight, ArrowDownRight, CalendarClock, Download } from 'lucide-react';
import { Card, CardHead, Stat, BarChart, money, fmtDate, useStore, Badge, Tabs, Progress, Button, exportCSV, LineChart } from './ui';
import { api } from './api';
import type { FinanceAnalytics } from './types';

const RANGES = ['30D', 'Quarter', 'YTD', '12M'] as const;
type Range = (typeof RANGES)[number];
const MONTHS_IN_RANGE: Record<Range, number> = { '30D': 1, Quarter: 3, YTD: 6, '12M': 12 };

export default function Dashboard() {
  const s = useStore();
  const { ws, caps } = s;
  const [range, setRange] = useState<Range>('12M');
  const [fin, setFin] = useState<FinanceAnalytics | null>(null);
  const [finError, setFinError] = useState('');

  useEffect(() => {
    if (!caps.finance) return;
    api.financeAnalytics().then(setFin).catch(e => setFinError(e instanceof Error ? e.message : 'Could not load finance data'));
  }, [caps.finance, ws]);

  const today = new Date(`${ws.today}T00:00:00`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const n = MONTHS_IN_RANGE[range];
  const months = fin?.months ?? [];
  const current = months.slice(12 - n);
  const previous = 12 - 2 * n >= 0 ? months.slice(12 - 2 * n, 12 - n) : null;
  const rev = current.reduce((a, m) => a + m.revenue, 0);
  const exp = current.reduce((a, m) => a + m.expenses, 0);
  const prevRev = previous ? previous.reduce((a, m) => a + m.revenue, 0) : null;
  const prevExp = previous ? previous.reduce((a, m) => a + m.expenses, 0) : null;
  const pct = (a: number, b: number | null) => (b && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : NaN);

  const cname = (id: string) => ws.clients.find(c => c.id === id)?.name ?? '—';
  const active = ws.projects.filter(p => p.status === 'Active' || p.status === 'Planning');
  const deadlines = ws.projects
    .flatMap(p => p.milestones.filter(m => !m.paid).map(m => ({ ...m, project: p.name })))
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 5);
  const myProjects = caps.finance ? ws.projects : ws.projects.filter(p => p.team.includes(ws.me.id) || caps.editProjects);

  // New clients per month for the last 12 months, from the client records (available to every role).
  const monthKeys = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }) };
  });
  const newClients = monthKeys.map(m => ws.clients.filter(c => c.since.startsWith(m.key)).length);

  const exportSummary = () => {
    exportCSV('alchemyx-summary', (fin?.months ?? []).map(m => ({ month: m.label, revenue: m.revenue, expenses: m.expenses, profit: m.revenue - m.expenses })));
    s.toast('Financial summary exported');
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-6 md:gap-4">
        <div>
          <p className="hidden text-xs font-medium uppercase tracking-[0.16em] text-accent md:block">Executive overview</p>
          <h1 className="mt-0.5 font-display text-xl font-semibold tracking-tight md:mt-1 md:text-2xl">{greeting}, {ws.me.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-neutral-500">{fmtDate(ws.today)} · {caps.finance ? 'Company performance' : 'Your projects and team'}</p>
        </div>
        {caps.finance && (
          <div className="flex items-center gap-2">
            <Tabs tabs={[...RANGES]} value={range} onChange={setRange} />
            <Button size="sm" disabled={!fin} onClick={exportSummary}><Download size={14} />Export</Button>
          </div>
        )}
      </div>

      {caps.finance && (
        finError ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">{finError}</div> : (
          <div className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-5">
            <Stat label="Total revenue" value={money(rev, true)} delta={pct(rev, prevRev)} icon={<Wallet size={16} />} hint={previous ? undefined : 'no earlier period'} />
            <Stat label="Expenses" value={money(exp, true)} delta={pct(exp, prevExp)} icon={<TrendingDown size={16} />} hint={previous ? undefined : 'no earlier period'} />
            <Stat label="Net profit" value={money(rev - exp, true)} delta={previous ? pct(rev - exp, (prevRev ?? 0) - (prevExp ?? 0)) : NaN} icon={<PiggyBank size={16} />} hint={previous ? undefined : 'no earlier period'} />
            <Stat label="Outstanding receivables" value={money(fin?.outstanding ?? 0, true)} icon={<Receipt size={16} />} hint={`${ws.invoices.filter(i => i.status === 'Overdue').length} overdue`} />
            <div className="col-span-2 xl:col-span-1"><Stat label="Active projects" value={String(active.length)} icon={<FolderKanban size={16} />} hint={`${ws.projects.length} total`} /></div>
          </div>
        )
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:mt-4 md:gap-4 xl:grid-cols-3">
        {caps.finance ? (
          <Card className="xl:col-span-2">
            <CardHead title="Revenue vs expenses" sub="Monthly, in LKR" right={<div className="flex gap-4 text-xs text-neutral-400"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" />Revenue</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-neutral-500" />Expenses</span></div>} />
            <div className="px-5 pb-4">
              {fin ? <BarChart labels={current.map(m => m.label)} series={[{ name: 'Revenue', data: current.map(m => m.revenue), color: '#FF6A2D' }, { name: 'Expenses', data: current.map(m => m.expenses), color: '#6b6b6b' }]} height={170} /> : <div className="grid h-40 place-items-center text-xs text-neutral-500">Loading…</div>}
            </div>
          </Card>
        ) : (
          <Card className="xl:col-span-2">
            <CardHead title="My projects" sub="Projects you are working on" />
            <div className="space-y-3 px-4 pb-4 md:space-y-4 md:px-5 md:pb-5">
              {myProjects.length ? myProjects.map(p => {
                const done = p.tasks.length ? (p.tasks.filter(t => t.status === 'Done').length / p.tasks.length) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div className="mb-1.5 flex justify-between text-xs"><span className="truncate text-neutral-200">{p.name}</span><span className="text-neutral-500">{Math.round(done)}% done</span></div>
                    <Progress value={done} />
                  </div>
                );
              }) : <p className="text-xs text-neutral-500">You are not assigned to any projects yet.</p>}
            </div>
          </Card>
        )}
        <Card>
          <CardHead title="Upcoming deadlines" sub="Delivery & payment milestones" right={<CalendarClock size={16} className="text-neutral-500" />} />
          <div className="space-y-1 px-3 pb-4">
            {deadlines.length ? deadlines.map((d, i) => {
              const days = Math.round((new Date(`${d.due}T00:00:00`).getTime() - today.getTime()) / 864e5);
              const dd = new Date(`${d.due}T00:00:00`);
              return (
                <div key={d.id + d.project} className={`items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03] ${i >= 3 ? "hidden md:flex" : "flex"}`}>
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-center text-[10px] leading-tight ${days < 21 ? 'bg-accent-soft text-accent' : 'bg-white/5 text-neutral-400'}`}><span className="text-sm font-semibold">{dd.getDate()}</span>{dd.toLocaleString('en', { month: 'short' })}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm text-neutral-200">{d.name}</div><div className="truncate text-xs text-neutral-500">{d.project}</div></div>
                  {caps.finance && <div className="text-right text-xs"><div className="text-neutral-300">{money(d.amount, true)}</div><div className="text-neutral-500">in {days}d</div></div>}
                </div>
              );
            }) : <p className="px-2 py-3 text-center text-xs text-neutral-500 md:py-6">No open milestones.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:mt-4 md:gap-4 xl:grid-cols-3">
        {caps.finance && (
          <Card>
            <CardHead title="Recent transactions" right={<button onClick={() => s.go('finance')} className="text-xs text-accent hover:underline">View all</button>} />
            <div className="px-3 pb-3">
              {ws.transactions.length ? ws.transactions.slice(0, 6).map((t, i) => (
                <div key={t.id} className={`items-center gap-3 rounded-lg px-2 py-2 ${i >= 3 ? "hidden md:flex" : "flex"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${t.type === 'Income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-neutral-400'}`}>{t.type === 'Income' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm">{t.desc}</div><div className="text-xs text-neutral-500">{fmtDate(t.date)} · {t.category}</div></div>
                  <span className={`text-sm font-medium ${t.type === 'Income' ? 'text-emerald-400' : 'text-neutral-300'}`}>{t.type === 'Income' ? '+' : '−'}{money(t.amount, true)}</span>
                </div>
              )) : <p className="px-2 py-3 text-center text-xs text-neutral-500 md:py-6">No transactions recorded yet.</p>}
            </div>
          </Card>
        )}
        {caps.finance && (
          <Card>
            <CardHead title="Open invoices" right={<button onClick={() => s.go('finance')} className="text-xs text-accent hover:underline">Manage</button>} />
            <div className="px-3 pb-3">
              {ws.invoices.filter(i => i.status !== 'Paid').map((i, idx) => (
                <div key={i.id} className={`items-center justify-between gap-3 rounded-lg px-2 py-2 ${idx >= 3 ? "hidden md:flex" : "flex"}`}>
                  <div className="min-w-0"><div className="truncate text-sm">{cname(i.clientId)}</div><div className="font-mono text-[11px] text-neutral-500">{i.id} · due {fmtDate(i.due)}</div></div>
                  <div className="flex flex-col items-end gap-1"><span className="text-sm font-medium">{money(i.amount, true)}</span><Badge>{i.status}</Badge></div>
                </div>
              ))}
              {!ws.invoices.some(i => i.status !== 'Paid') && <p className="px-2 py-3 text-center text-xs text-neutral-500 md:py-6">No open invoices.</p>}
            </div>
          </Card>
        )}
        <Card>
          <CardHead title="Project performance" sub="Task progress and budget use" />
          <div className="space-y-3 px-4 pb-4 md:space-y-4 md:px-5 md:pb-5">
            {ws.projects.filter(p => p.status !== 'Completed').map(p => {
              const done = p.tasks.length ? (p.tasks.filter(t => t.status === 'Done').length / p.tasks.length) * 100 : 0;
              const burn = p.budget ? (p.spent / p.budget) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="truncate text-neutral-200">{p.name}</span><span className="text-neutral-500">{Math.round(done)}% done{caps.finance ? ` · burn ${Math.round(burn)}%` : ''}</span></div>
                  <Progress value={done} warn={caps.finance && burn - done > 40} />
                </div>
              );
            })}
            {!ws.projects.length && <p className="text-xs text-neutral-500">No projects yet.</p>}
          </div>
          <div className="mx-5 mb-5 rounded-xl border border-line/60 bg-base/50 p-4 max-md:hidden">
            <div className="flex items-center justify-between text-xs text-neutral-500"><span>New clients · 12 months</span><span className="font-semibold text-neutral-100">{newClients.reduce((a, b) => a + b, 0)}</span></div>
            <LineChart labels={monthKeys.map(m => m.label)} data={newClients} height={60} fmt={v => `${v} clients`} />
          </div>
        </Card>
      </div>
      {caps.finance && fin && <div className="mt-3 md:mt-4"><Card><CardHead title="Cash position" sub={`Opening balance plus income less expenses · ${money(fin.cashPosition)} today`} /><div className="px-5 pb-5"><LineChart labels={fin.cash.map(c => c.label)} data={fin.cash.map(c => c.balance)} height={120} /></div></Card></div>}
    </div>
  );
}
