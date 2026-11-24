import type { FinanceAnalytics, Workspace, Member, Subscription } from './types';

// Base URL of the Spring Boot backend. Set VITE_API_URL at build time for deployments.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';
const TOKEN_KEY = 'alchemyx.token';

/** Session token kept in this browser only. Storage can be unavailable (private mode), so every access is guarded. */
export const session = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: the user will simply need to sign in again */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = session.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  try {
    return await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Cannot reach the AlchemyX server. Check your connection and try again.');
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body);
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Downloads a file through the authenticated API and saves it locally. */
export async function download(path: string, fileName: string) {
  const res = await send('GET', path);
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, (safeJson(text) as { error?: string } | undefined)?.error ?? 'Download failed');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; expiresAt: string; member: Member }>('POST', '/api/auth/login', { username, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  workspace: () => request<Workspace>('GET', '/api/workspace'),
  financeAnalytics: () => request<FinanceAnalytics>('GET', '/api/analytics/finance'),

  members: {
    create: (b: { name: string; username: string; email: string; password: string; access: string; jobTitle: string; department: string; capacityHours: number }) =>
      request<Member>('POST', '/api/members', b),
    update: (id: string, b: Partial<{ access: string; jobTitle: string; department: string; capacityHours: number; availability: string }>) =>
      request<Member>('PATCH', `/api/members/${id}`, b),
  },

  clients: {
    create: (b: Record<string, unknown>) => request<void>('POST', '/api/clients', b),
    update: (id: string, b: Record<string, unknown>) => request<void>('PATCH', `/api/clients/${id}`, b),
    addNote: (id: string, b: { type: string; text: string }) => request<void>('POST', `/api/clients/${id}/notes`, b),
  },

  projects: {
    create: (b: Record<string, unknown>) => request<void>('POST', '/api/projects', b),
    setStatus: (id: string, status: string) => request<void>('PATCH', `/api/projects/${id}`, { status }),
    remove: (id: string) => request<void>('DELETE', `/api/projects/${id}`),
    assign: (id: string, memberId: string) => request<void>('POST', `/api/projects/${id}/team`, { memberId }),
    addTask: (id: string, b: { title: string; assigneeId: string | null; due: string }) =>
      request<void>('POST', `/api/projects/${id}/tasks`, b),
    moveTask: (id: string, taskId: string, status: string) =>
      request<void>('PATCH', `/api/projects/${id}/tasks/${taskId}`, { status }),
    setMilestonePaid: (id: string, milestoneId: string, paid: boolean) =>
      request<void>('PATCH', `/api/projects/${id}/milestones/${milestoneId}`, { paid }),
  },

  orders: {
    create: (b: Record<string, unknown>) => request<void>('POST', '/api/orders', b),
    setStatus: (id: string, status: string) => request<void>('PATCH', `/api/orders/${id}`, { status }),
    invoice: (id: string) => request<void>('POST', `/api/orders/${id}/invoice`),
  },

  invoices: {
    create: (b: Record<string, unknown>) => request<void>('POST', '/api/invoices', b),
    setStatus: (id: string, status: string) => request<void>('PATCH', `/api/invoices/${id}`, { status }),
  },

  subscriptions: {
    list: () => request<Subscription[]>('GET', '/api/subscriptions'),
    create: (b: { clientId: string; plan: string; monthlyAmount: number; start: string }) =>
      request<void>('POST', '/api/subscriptions', b),
    setStatus: (id: string, status: string) => request<void>('PATCH', `/api/subscriptions/${id}`, { status }),
    bill: (id: string) => request<void>('POST', `/api/subscriptions/${id}/bill`),
    billDue: () => request<{ invoices: number }>('POST', '/api/subscriptions/bill-due'),
  },

  transactions: {
    create: (b: Record<string, unknown>) => request<void>('POST', '/api/transactions', b),
  },

  timesheets: {
    save: (weekStart: string, entries: { memberId: string; date: string; hours: number }[]) =>
      request<void>('PUT', '/api/timesheets', { weekStart, entries }),
    submit: (weekStart: string) => request<void>('POST', '/api/timesheets/submit', { weekStart }),
  },

  leave: {
    request: (b: { type: string; from: string; to: string }) => request<void>('POST', '/api/leave', b),
    decide: (id: string, status: 'Approved' | 'Rejected') => request<void>('PATCH', `/api/leave/${id}`, { status }),
  },

  documents: {
    upload: (form: FormData) => request<void>('POST', '/api/documents', form),
    newVersion: (id: string, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return request<void>('POST', `/api/documents/${id}/versions`, form);
    },
    setStatus: (id: string, status: string) => request<void>('PATCH', `/api/documents/${id}`, { status }),
    download: (id: string, fileName: string, version?: number) =>
      download(`/api/documents/${id}/download${version ? `?${q({ version: String(version) })}` : ''}`, fileName),
  },

  settings: {
    update: (b: Record<string, unknown>) => request<void>('PATCH', '/api/settings', b),
    services: (services: string[]) => request<void>('PUT', '/api/settings/services', { services }),
  },
};
