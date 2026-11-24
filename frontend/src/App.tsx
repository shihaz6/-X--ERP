import { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, Users, FolderKanban, ShoppingCart, Wallet, UsersRound, FileText, BarChart3, Settings as Cog, Search, Bell, ChevronsLeft, ChevronDown, LogOut, Lock } from 'lucide-react';
import { StoreProvider, useStore, Logo, Avatar, Button, Field, Input, Spinner, Empty, money } from './ui';
import { api, session, ApiError } from './api';
import type { Capabilities } from './types';
import Dashboard from './Dashboard';
import CRM from './CRM';
import Projects from './Projects';
import Orders from './Orders';
import Finance from './Finance';
import Team from './Team';
import Documents from './Documents';
import Analytics from './Analytics';
import Settings from './Settings';

interface NavItem { id: string; label: string; icon: typeof LayoutDashboard; el: () => React.ReactElement; allowed: (c: Capabilities) => boolean }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, el: Dashboard, allowed: () => true },
  { id: 'crm', label: 'Clients & CRM', icon: Users, el: CRM, allowed: c => c.crm },
  { id: 'projects', label: 'Projects', icon: FolderKanban, el: Projects, allowed: () => true },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, el: Orders, allowed: c => c.orders },
  { id: 'finance', label: 'Finance', icon: Wallet, el: Finance, allowed: c => c.finance },
  { id: 'team', label: 'Team', icon: UsersRound, el: Team, allowed: c => c.team },
  { id: 'documents', label: 'Documents', icon: FileText, el: Documents, allowed: () => true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, el: Analytics, allowed: c => c.finance },
  { id: 'settings', label: 'Settings', icon: Cog, el: Settings, allowed: c => c.admin },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [authed, setAuthed] = useState(() => !!session.get());
  const signOut = useCallback(() => {
    api.logout().catch(() => undefined);
    session.set(null);
    setAuthed(false);
  }, []);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <StoreProvider go={setPage} onSignedOut={signOut}>
      <Shell page={page} setPage={setPage} signOut={signOut} />
    </StoreProvider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return setErr('Enter your username or work email');
    if (!pw) return setErr('Enter your password');
    setErr(''); setBusy(true);
    try {
      const res = await api.login(username.trim(), pw);
      session.set(res.token);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Sign-in failed. Try again.');
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line/60 bg-base p-12 lg:flex lg:flex-col">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full border border-accent/15" />
        <div className="absolute -right-20 -top-20 h-[360px] w-[360px] rounded-full border border-accent/25" />
        <Logo size={40} />
        <div className="mt-auto max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">Run the business behind the <span className="text-accent">intelligence.</span></h1>
          <p className="mt-4 text-neutral-400">Clients, projects, orders, finance and your team, all in one AlchemyX workspace.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="fade-up w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-2xl font-semibold">Sign in to AlchemyX ERP</h2>
          <p className="mb-6 mt-1 text-sm text-neutral-500">Internal workspace. Use the account your administrator created for you.</p>
          <div className="space-y-4">
            <Field label="Username or work email"><Input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></Field>
            <Field label="Password" error={err}><Input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
            <Button variant="primary" type="submit" className="h-10 w-full" disabled={busy}>{busy ? <><Spinner />Signing in…</> : 'Sign in'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Shell({ page, setPage, signOut }: { page: string; setPage: (p: string) => void; signOut: () => void }) {
  const s = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<null | 'notif' | 'user'>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { ws, caps, user } = s;
  const allowed = NAV.filter(n => n.allowed(caps));
  const current = NAV.find(n => n.id === page) ?? NAV[0];
  const Page = current.el;
  const permitted = current.allowed(caps);
  const companyName = ws.settings.company.name || 'Set up your company in Settings';
  const clientName = (id: string) => ws.clients.find(c => c.id === id)?.name ?? '—';

  const navigate = (p: string) => { setLoading(true); setPage(p); setMenu(null); setQ(''); setTimeout(() => setLoading(false), 250); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const needle = q.toLowerCase();
  const results = q.length > 1 ? [
    ...ws.clients.filter(c => c.name.toLowerCase().includes(needle)).map(c => ({ t: c.name, k: 'Client', p: 'crm' })),
    ...ws.projects.filter(p => p.name.toLowerCase().includes(needle)).map(p => ({ t: p.name, k: 'Project', p: 'projects' })),
    ...ws.orders.filter(o => (o.id + o.title).toLowerCase().includes(needle)).map(o => ({ t: `${o.id} · ${o.title}`, k: 'Order', p: 'orders' })),
    ...ws.invoices.filter(i => i.id.toLowerCase().includes(needle)).map(i => ({ t: i.id, k: 'Invoice', p: 'finance' })),
    ...ws.members.filter(m => m.name.toLowerCase().includes(needle)).map(m => ({ t: m.name, k: 'Team', p: 'team' })),
  ].filter(r => NAV.find(n => n.id === r.p)?.allowed(caps)).slice(0, 8) : [];

  const notifs = [
    ...ws.invoices.filter(i => i.status === 'Overdue').map(i => ({ t: `${i.id} is overdue`, d: money(i.amount, true), p: 'finance' })),
    ...ws.orders.filter(o => o.status === 'Pending').map(o => ({ t: 'Order awaiting approval', d: o.title, p: 'orders' })),
    ...(caps.manager ? ws.leaves.filter(l => l.status === 'Pending').map(l => ({ t: 'Leave request pending', d: ws.members.find(m => m.id === l.memberId)?.name ?? '', p: 'team' })) : []),
  ];

  return (
    <div className="flex h-full bg-ink">
      <aside className={`flex shrink-0 flex-col border-r border-line/60 bg-base transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[248px]'}`}>
        <div className="flex h-16 items-center px-5"><Logo collapsed={collapsed} /></div>
        <div className={`mx-3 mb-3 rounded-xl border border-line/60 bg-panel px-3 py-2 ${collapsed ? 'hidden' : ''}`}>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Workspace</div>
          <div className="truncate text-sm font-medium">{companyName}</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map(n => {
            const ok = allowed.includes(n);
            const active = page === n.id;
            return (
              <button key={n.id} title={n.label} onClick={() => ok && navigate(n.id)} className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? 'bg-accent-soft text-accent' : ok ? 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100' : 'cursor-not-allowed text-neutral-700'}`}>
                {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-accent" />}
                <n.icon size={18} className="shrink-0" />
                {!collapsed && <span className="flex-1 text-left">{n.label}</span>}
                {!collapsed && !ok && <Lock size={12} />}
              </button>
            );
          })}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-neutral-500 hover:bg-white/5 hover:text-neutral-300">
          <ChevronsLeft size={16} className={`transition ${collapsed ? 'rotate-180' : ''}`} />{!collapsed && 'Collapse'}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-16 shrink-0 items-center gap-4 border-b border-line/60 bg-base/80 px-6 backdrop-blur">
          <div className="relative w-full max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients, projects, orders, invoices…" className="h-9 w-full rounded-lg border border-line bg-panel pl-9 pr-14 text-sm outline-none placeholder:text-neutral-600 focus:border-accent/60" />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 text-[10px] text-neutral-500">Ctrl K</kbd>
            {q.length > 1 && (
              <div className="pop absolute left-0 right-0 top-11 rounded-xl border border-line bg-panel p-1.5 shadow-2xl">
                {results.length ? results.map((r, i) => <button key={i} onClick={() => navigate(r.p)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"><span className="truncate">{r.t}</span><span className="text-[11px] text-neutral-500">{r.k}</span></button>) : <div className="px-3 py-4 text-center text-xs text-neutral-500">No results for "{q}"</div>}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setMenu(menu === 'notif' ? null : 'notif')} className="relative grid h-9 w-9 place-items-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-neutral-100"><Bell size={18} />{notifs.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-base" />}</button>
              {menu === 'notif' && (
                <div className="pop absolute right-0 top-11 w-80 rounded-xl border border-line bg-panel p-2 shadow-2xl">
                  <div className="px-2 py-1.5 text-xs font-medium text-neutral-400">Notifications · {notifs.length}</div>
                  {notifs.length ? notifs.map((n, i) => <button key={i} onClick={() => NAV.find(x => x.id === n.p)?.allowed(caps) && navigate(n.p)} className="block w-full rounded-lg px-2 py-2 text-left hover:bg-white/5"><div className="text-sm">{n.t}</div><div className="text-xs text-neutral-500">{n.d}</div></button>) : <div className="py-6 text-center text-xs text-neutral-500">You're all caught up</div>}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setMenu(menu === 'user' ? null : 'user')} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-white/5">
                <Avatar m={user} size={30} />
                <div className="hidden text-left leading-tight md:block"><div className="text-sm">{user.name}</div><div className="text-[11px] text-neutral-500">{user.access}</div></div>
                <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {menu === 'user' && (
                <div className="pop absolute right-0 top-12 w-56 rounded-xl border border-line bg-panel p-2 shadow-2xl">
                  <div className="px-2 py-1.5 text-xs text-neutral-500">{user.email}</div>
                  <div className="my-1 border-t border-line/60" />
                  <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-300 hover:bg-white/5"><LogOut size={14} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto" onClick={() => menu && setMenu(null)}>
          <div className="mx-auto max-w-[1440px] p-6 lg:p-8">
            {loading ? (
              <div className="space-y-4"><div className="h-8 w-64 animate-pulse rounded-lg bg-white/5" /><div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />)}</div><div className="h-72 animate-pulse rounded-2xl bg-white/5" /></div>
            ) : permitted ? <div key={page} className="fade-up"><Page /></div> : <Empty title="Access restricted" text={`Your role (${user.access}) does not have permission to view ${current.label}.`} />}
          </div>
        </main>
      </div>
    </div>
  );
}
