import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Card, CardHead, PageHeader, Button, Tabs, LineChart, BarChart, Donut, PALETTE, Table, money, useStore, exportCSV, Empty } from './ui';
import { api } from './api';
import type { FinanceAnalytics } from './types';

const SERVICE_LINES = ['Software Development', 'AI Solutions', 'Business Automation', 'Consulting', 'Enterprise Software'];

export default function Analytics() {
  const s = useStore();
  const { ws, caps } = s;
  const [period, setPeriod] = useState<'Monthly' | 'Annual'>('Monthly');
  const [fin, setFin] = useState<FinanceAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.financeAnalytics().then(setFin).catch(e => setError(e instanceof Error ? e.message : 'Could not load analytics'));
  }, [ws]);

  if (error) return <Empty title="Analytics unavailable" text={error} />;
  if (!fin) return <div className="grid h-40 place-items-center text-sm text-neutral-500">Loading analytics…</div>;

  const months = fin.months;
  const revenues = months.map(m => m.revenue);
  const growth = revenues.slice(1).map((r, i) => (revenues[i] ? ((r - revenues[i]) / revenues[i]) * 100 : 0));
  const avgGrowth = growth.length ? growth.reduce((a, b) => a + b, 0) / growth.length : 0;
  const totalRev = revenues.reduce((a, b) => a + b, 0);
  const totalExp = months.reduce((a, m) => a + m.expenses, 0);
  const netMargin = totalRev ? ((totalRev - totalExp) / totalRev) * 100 : 0;
  const fy = fin.fiscalYears;
  const yoy = fy.length >= 2 && fy[fy.length - 2].revenue ? ((fy[fy.length - 1].revenue - fy[fy.length - 2].revenue) / fy[fy.length - 2].revenue) * 100 : null;
  const newClients = months.reduce((a, m) => a + m.newClients, 0);
  const avgDeal = ws.clients.length ? ws.clients.reduce((a, b) => a + b.value, 0) / ws.clients.length : 0;

  const prof = ws.projects.map(p => {
    const rev = p.milestones.filter(m => m.paid).reduce((a, b) => a + b.amount, 0);
    return { ...p, rev, margin: rev ? ((rev - p.spent) / rev) * 100 : 0 };
  });
  const svc = SERVICE_LINES.map((sv, i) => {
    const os = ws.orders.filter(o => o.service === sv && o.status !== 'Cancelled');
    return { sv, n: os.length, v: os.reduce((a, b) => a + b.amount, 0), color: PALETTE[i] };
  });

  return (
    <div>
      <PageHeader title="Analytics & BI" sub="Growth, profitability and service performance" actions={<>
        <Tabs tabs={['Monthly', 'Annual']} value={period} onChange={setPeriod} />
        <Button onClick={() => { exportCSV('alchemyx-project-profitability', prof.map(p => ({ project: p.name, revenue: p.rev, cost: p.spent, margin: p.rev ? p.margin.toFixed(1) + '%' : '—' }))); s.toast('Report exported'); }}><Download size={14} />Export report</Button>
      </>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHead title="Revenue growth trend" sub={period === 'Monthly' ? 'Revenue per month, last 12 months' : 'Revenue vs expenses by fiscal year'} />
          <div className="px-5 pb-4">{period === 'Monthly'
            ? <LineChart labels={months.map(m => m.label)} data={revenues} />
            : <BarChart labels={fy.map(f => f.label)} series={[{ name: 'Revenue', data: fy.map(f => f.revenue), color: '#FF6A2D' }, { name: 'Expenses', data: fy.map(f => f.expenses), color: '#6b6b6b' }]} height={180} />}</div>
          <div className="grid grid-cols-3 border-t border-line/60 text-center text-xs">{[
            ['Avg MoM growth', `${avgGrowth.toFixed(1)}%`],
            ['YoY growth', yoy === null ? '—' : `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`],
            ['Net margin (12M)', totalRev ? `${netMargin.toFixed(1)}%` : '—'],
          ].map(([l, v]) => <div key={l} className="py-3"><div className="text-neutral-500">{l}</div><div className="mt-0.5 font-display text-base font-semibold">{v}</div></div>)}</div>
        </Card>
        <Card><CardHead title="Client acquisition" sub="New clients per month" />
          <div className="px-5 pb-4"><LineChart labels={months.map(m => m.label)} data={months.map(m => m.newClients)} color="#e9e9e9" fmt={v => `${v} clients`} /></div>
          <div className="grid grid-cols-2 border-t border-line/60 text-center text-xs">{[
            ['New (12M)', String(newClients)],
            ...(caps.crm ? [['Avg deal size', money(avgDeal, true)]] : []),
          ].map(([l, v]) => <div key={l} className="py-3"><div className="text-neutral-500">{l}</div><div className="mt-0.5 font-display text-base font-semibold">{v}</div></div>)}</div>
        </Card>
        <Card><CardHead title="Service performance" sub="Booked value by service line (excludes cancelled)" />
          <div className="px-5 pb-5">{svc.some(x => x.v > 0)
            ? <><Donut items={svc.map(x => ({ label: x.sv, value: x.v, color: x.color }))} />
              <div className="mt-4 space-y-1.5">{svc.map(x => <div key={x.sv} className="flex justify-between text-xs"><span className="text-neutral-400">{x.sv}</span><span>{x.n} orders · {money(x.v, true)}</span></div>)}</div></>
            : <Empty title="No orders yet" text="Booked value by service line appears once orders are created." />}</div>
        </Card>
        <Card><CardHead title="Project profitability" sub="Paid milestones less recorded project expenses" />
          <Table rows={prof} empty={<Empty title="No projects yet" text="Profitability appears once projects have milestones." />} cols={[
            { h: 'Project', r: p => p.name },
            { h: 'Revenue', r: p => money(p.rev, true) },
            { h: 'Cost', r: p => money(p.spent, true) },
            { h: 'Margin', cls: 'text-right', r: p => <span className={p.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}>{p.rev ? p.margin.toFixed(0) + '%' : '—'}</span> },
          ]} />
        </Card>
      </div>
    </div>
  );
}
