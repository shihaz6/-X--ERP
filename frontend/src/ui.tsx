import { createContext, useContext, useState, useEffect, useCallback, useRef, useId, Component, type ReactNode } from 'react';
import { X, Check, AlertTriangle, Loader2, Inbox } from 'lucide-react';
import { api, ApiError } from './api';
import type { Capabilities, Member, Role, Workspace } from './types';

/* ---------- formatting (all amounts are LKR) ---------- */
export const money = (v: number, compact = false) => {
  const n = Number(v) || 0;
  if (compact && Math.abs(n) >= 1_000_000) return `LKR ${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000) return `LKR ${(n / 1_000).toFixed(0)}K`;
  return `LKR ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
export const fmtDate = (d: string | null | undefined) =>
  d && d !== '—' ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const shortDate = (d: string | null | undefined) => fmtDate(d).slice(0, 6);
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- store ---------- */
export interface Ctx {
  ws: Workspace;
  user: Member;
  role: Role;
  caps: Capabilities;
  /** Re-reads the workspace from the server. */
  refresh: () => Promise<void>;
  /** Runs a server action, shows the result, then refreshes. Resolves true on success. */
  act: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
  toast: (msg: string, kind?: 'ok' | 'warn') => void;
  go: (page: string) => void;
}
const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children, go, onSignedOut }: { children: ReactNode; go: (p: string) => void; onSignedOut: () => void }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loadError, setLoadError] = useState('');
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((msg: string, kind: 'ok' | 'warn' = 'ok') => {
    const id = nextId.current++;
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      onSignedOut();
      return;
    }
    toast(e instanceof Error ? e.message : 'Something went wrong', 'warn');
  }, [onSignedOut, toast]);

  const refresh = useCallback(async () => {
    try {
      setWs(await api.workspace());
      setLoadError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onSignedOut();
      setLoadError(e instanceof Error ? e.message : 'Could not load the workspace');
    }
  }, [onSignedOut]);

  useEffect(() => { refresh(); }, [refresh]);

  const act = useCallback(async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast(success);
      await refresh();
      return true;
    } catch (e) {
      handleError(e);
      return false;
    }
  }, [refresh, toast, handleError]);

  if (!ws) {
    return (
      <div className="grid h-full place-items-center text-sm text-neutral-400">
        {loadError ? (
          <div className="text-center">
            <p className="text-red-400">{loadError}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={refresh}>Try again</Button>
              <Button variant="ghost" onClick={onSignedOut}>Sign out</Button>
            </div>
          </div>
        ) : (
          <span className="flex items-center gap-2"><Spinner />Loading workspace…</span>
        )}
      </div>
    );
  }

  const ctx: Ctx = { ws, user: ws.me, role: ws.me.access, caps: ws.capabilities, refresh, act, toast, go };
  return (
    <StoreCtx.Provider value={ctx}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="pop flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm shadow-2xl shadow-black/40">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${t.kind === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{t.kind === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}

/* ---------- logo ---------- */
export function Logo({ collapsed = false, size = 32 }: { collapsed?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="AlchemyX">
        <rect width="40" height="40" rx="10" fill="#FF6A2D" />
        <path d="M11 29 19.2 10h1.6L29 29h-4.2l-1.8-4.3h-6l-1.8 4.3H11Zm7.4-7.7h3.2L20 17.3l-1.6 4Z" fill="#1c1c1c" />
        <path d="m26 11 3 3m0-3-3 3" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-[17px] font-bold tracking-tight">Alchemy<span className="text-accent">X</span></div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">Where AI Meets Business</div>
        </div>
      )}
    </div>
  );
}

/* ---------- primitives ---------- */
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-line/70 bg-panel shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] ${className}`}>{children}</div>
);
export const CardHead = ({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2.5 md:px-5 md:pt-5 md:pb-3">
    <div><h3 className="text-[15px] font-semibold text-neutral-100">{title}</h3>{sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}</div>
    {right}
  </div>
);

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger'; size?: 'sm' | 'md' };
export function Button({ variant = 'outline', size = 'md', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-accent text-[#1c1c1c] hover:bg-[#ff7d47] font-semibold shadow-[0_6px_20px_-8px_#ff6a2d]',
    outline: 'border border-line bg-raised/60 text-neutral-200 hover:border-neutral-500 hover:bg-raised',
    ghost: 'text-neutral-300 hover:bg-white/5',
    danger: 'bg-red-500/90 text-white hover:bg-red-500 font-semibold',
  }[variant];
  const s = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm';
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 ${v} ${s} ${className}`} />;
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-500/12 text-emerald-400 ring-emerald-500/20',
  orange: 'bg-accent/12 text-accent ring-accent/25',
  amber: 'bg-amber-500/12 text-amber-400 ring-amber-500/20',
  red: 'bg-red-500/12 text-red-400 ring-red-500/20',
  sky: 'bg-sky-500/12 text-sky-300 ring-sky-500/20',
  violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/20',
  gray: 'bg-white/5 text-neutral-400 ring-white/10',
};
const STATUS_TONE: Record<string, string> = {
  Paid: 'green', Completed: 'green', Won: 'green', Signed: 'green', Done: 'green', Approved: 'green', Available: 'green', Income: 'green', Delivered: 'sky',
  Active: 'orange', 'In Progress': 'orange', Negotiation: 'orange', Busy: 'orange', High: 'orange', Review: 'violet', 'In Review': 'violet', Proposal: 'violet',
  Pending: 'amber', Sent: 'sky', Planning: 'sky', Qualified: 'sky', Medium: 'sky', 'On Hold': 'amber', 'On Leave': 'amber', Draft: 'gray', Lead: 'gray', Backlog: 'gray', Low: 'gray', Archived: 'gray',
  Overdue: 'red', Cancelled: 'red', Lost: 'red', Critical: 'red', Rejected: 'red', Expense: 'red',
};
export const Badge = ({ children, tone }: { children: ReactNode; tone?: string }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone ?? STATUS_TONE[String(children)] ?? 'gray']}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{children}
  </span>
);

export const Avatar = ({ m, size = 28 }: { m?: Member | null; size?: number }) => (
  <span title={m?.name} style={{ width: size, height: size, fontSize: size * 0.38 }} className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-700 font-semibold text-neutral-100 ring-2 ring-panel">{m?.initials ?? '?'}</span>
);

export const Progress = ({ value, warn }: { value: number; warn?: boolean }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
    <div className={`h-full rounded-full transition-all duration-700 ${warn ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

export function Modal({ open, onClose, title, sub, children, footer, wide }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) dialogRef.current?.focus(); }, [open]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 sm:p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onMouseDown={e => e.stopPropagation()} className={`pop flex h-full w-full flex-col border-line bg-panel shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-start justify-between border-b border-line/70 px-6 py-4">
          <div><h2 id={titleId} className="text-base font-semibold">{title}</h2>{sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}</div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-200"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line/70 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, text, cta = 'Confirm', danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: string; cta?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{cta}</Button></>}>
      <p className="text-sm text-neutral-400">{text}</p>
    </Modal>
  );
}

export const Field = ({ label, error, children, className = '' }: { label: string; error?: string; children: ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-medium text-neutral-400">{label}</span>
    {children}
    {error && <span className="mt-1 block text-[11px] text-red-400">{error}</span>}
  </label>
);
const inputCls = 'h-9 w-full rounded-lg border border-line bg-base px-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${inputCls} h-auto min-h-20 py-2 ${p.className ?? ''}`} />;
export const Select = ({ options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | [string, string])[] }) => (
  <select {...p} className={`${inputCls} pr-8 ${p.className ?? ''}`}>
    {options.map(o => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
  </select>
);

export const Empty = ({ title, text, action }: { title: string; text: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-neutral-500"><Inbox size={22} /></div>
    <div className="text-sm font-medium text-neutral-200">{title}</div>
    <p className="mt-1 max-w-xs text-xs text-neutral-500">{text}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Spinner = () => <Loader2 size={16} className="animate-spin" />;

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-base p-0.5">
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${value === t ? 'bg-raised text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}>{t}</button>
      ))}
    </div>
  );
}

export const PageHeader = ({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{sub}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export function Stat({ label, value, delta, icon, hint }: { label: string; value: string; delta?: number; icon: ReactNode; hint?: string }) {
  return (
    <Card className="fade-up p-3.5 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium leading-tight text-neutral-500 md:text-xs">{label}</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent md:h-8 md:w-8">{icon}</span>
      </div>
      <div className="mt-2 font-display text-lg font-semibold tracking-tight md:mt-3 md:text-[26px]">{value}</div>
      <div className="mt-0.5 truncate text-[11px] md:mt-1 md:text-xs">
        {delta !== undefined && isFinite(delta) && <span className={delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span>}
        <span className="ml-1.5 text-neutral-500 max-md:hidden">{hint ?? 'vs previous period'}</span>
      </div>
    </Card>
  );
}

/* ---------- table ---------- */
export function Table<T>({ rows, cols, onRow, empty }: { rows: T[]; cols: { h: string; r: (row: T) => ReactNode; cls?: string }[]; onRow?: (row: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <>{empty ?? <Empty title="Nothing here yet" text="Try adjusting filters or create a new record." />}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line/70 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            {cols.map(c => <th key={c.h} className={`px-3 py-2.5 font-medium md:px-5 md:py-3 ${c.cls ?? ''}`}>{c.h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} onClick={() => onRow?.(row)} className={`border-b border-line/40 last:border-0 transition ${onRow ? 'cursor-pointer hover:bg-white/[0.025]' : ''}`}>
              {cols.map(c => <td key={c.h} className={`px-3 py-2.5 text-neutral-300 md:px-5 md:py-3 ${c.cls ?? ''}`}>{c.r(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- charts (SVG, no deps) ---------- */
export function BarChart({ labels, series, height = 220 }: { labels: string[]; series: { name: string; data: number[]; color: string }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = (Math.max(...series.flatMap(s => s.data)) || 1) * 1.1;
  const W = 640, H = height, pad = 28, gw = (W - pad) / labels.length, bw = Math.min(14, (gw - 10) / series.length);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={pad} x2={W} y1={H - f * H} y2={H - f * H} stroke="#3a3a3a" strokeDasharray="3 4" strokeWidth="0.7" />)}
        {[0.5, 1].map(f => <text key={f} x={0} y={H - f * H + 4} fontSize="10" fill="#777">{(max * f / 1e6).toFixed(0)}M</text>)}
        {labels.map((l, i) => (
          <g key={l + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={pad + i * gw} y={0} width={gw} height={H} fill={hover === i ? '#ffffff08' : 'transparent'} rx="6" />
            {series.map((s, j) => {
              const h = (s.data[i] / max) * H;
              const x = pad + i * gw + gw / 2 - (series.length * bw + (series.length - 1) * 3) / 2 + j * (bw + 3);
              return <rect key={s.name} x={x} y={H - h} width={bw} height={h} rx="3" fill={s.color} style={{ transition: 'all .5s' }} />;
            })}
            <text x={pad + i * gw + gw / 2} y={H + 18} fontSize="10" fill="#888" textAnchor="middle">{l}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 rounded-lg border border-line bg-base/95 px-3 py-2 text-xs shadow-xl" style={{ left: `${Math.min(75, ((hover + 0.5) / labels.length) * 100)}%` }}>
          <div className="mb-1 font-medium">{labels[hover]}</div>
          {series.map(s => <div key={s.name} className="flex items-center gap-2 text-neutral-400"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.name}: <span className="text-neutral-100">{money(s.data[hover], true)}</span></div>)}
        </div>
      )}
    </div>
  );
}

export function LineChart({ labels, data, height = 180, color = '#FF6A2D', fmt = (v: number) => money(v, true) }: { labels: string[]; data: number[]; height?: number; color?: string; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, max = Math.max(...data, 1) * 1.1, min = Math.min(0, ...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * W, H - ((v - min) / span) * H] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const gid = 'g' + color.slice(1);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={0} x2={W} y1={H - f * H} y2={H - f * H} stroke="#3a3a3a" strokeDasharray="3 4" strokeWidth="0.7" />)}
        <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={p[0] - W / data.length / 2} y={0} width={W / data.length} height={H} fill="transparent" />
            <circle cx={p[0]} cy={p[1]} r={hover === i ? 5 : 0} fill={color} stroke="#2b2b2b" strokeWidth="2" />
            <text x={p[0]} y={H + 18} fontSize="10" fill="#888" textAnchor="middle">{labels[i]}</text>
          </g>
        ))}
      </svg>
      {hover !== null && <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-base/95 px-3 py-1.5 text-xs shadow-xl" style={{ left: `${Math.min(80, (hover / Math.max(1, data.length - 1)) * 100)}%` }}>{labels[hover]} · <span className="font-medium">{fmt(data[hover])}</span></div>}
    </div>
  );
}

export function Donut({ items, size = 150 }: { items: { label: string; value: number; color: string }[]; size?: number }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const r = 15.9;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 42 42" className="-rotate-90 shrink-0">
        <circle cx="21" cy="21" r={r} fill="none" stroke="#333" strokeWidth="5" />
        {items.map(it => {
          const pct = (it.value / total) * 100;
          const el = <circle key={it.label} cx="21" cy="21" r={r} fill="none" stroke={it.color} strokeWidth="5" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-acc} />;
          acc += pct;
          return el;
        })}
      </svg>
      <div className="space-y-2 text-xs">
        {items.map(it => (
          <div key={it.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
            <span className="text-neutral-400">{it.label}</span>
            <span className="ml-auto pl-3 font-medium text-neutral-200">{Math.round((it.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export const PALETTE = ['#FF6A2D', '#ffa47a', '#e9e9e9', '#8a8a8a', '#5a5a5a', '#c2410c'];

export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name}.csv`;
  a.click();
}

/* ---------- error boundary: one failing screen must not blank the app ---------- */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="mx-auto max-w-lg py-16 text-center">
          <h2 className="text-base font-semibold text-neutral-100">This section could not be displayed</h2>
          <p className="mt-2 text-xs text-neutral-500">{this.state.error.message}</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- pager ---------- */
export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-5 py-3 text-xs text-neutral-400">
      <span>{total} records · page {page + 1} of {pages}</span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
