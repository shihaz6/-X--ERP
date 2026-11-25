import { badRequest, forbidden } from './errors';

/** Access roles. The label is shown in the UI; the enum name is stored in the database. */
export type Role = 'SUPER_ADMIN' | 'FINANCE_MANAGER' | 'PROJECT_MANAGER' | 'DEVELOPER';

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  FINANCE_MANAGER: 'Finance Manager',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
};

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

/** Accepts the label ("Super Admin") or the enum name ("SUPER_ADMIN"), in any case. */
export function parseRole(value: unknown): Role {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const found = ROLES.find(r => ROLE_LABELS[r].toLowerCase() === text || r.toLowerCase() === text);
  if (!found) throw badRequest(`Unknown role: ${value ?? ''}`);
  return found;
}

/** Role rules. These mirror the Spring Permissions class so the server enforces the same boundaries. */
export const Permissions = {
  finance: (r: Role) => r === 'SUPER_ADMIN' || r === 'FINANCE_MANAGER',
  editFinance: (r: Role) => Permissions.finance(r),
  crm: (r: Role) => r === 'SUPER_ADMIN' || r === 'PROJECT_MANAGER' || r === 'FINANCE_MANAGER',
  editCrm: (r: Role) => r === 'SUPER_ADMIN' || r === 'PROJECT_MANAGER',
  orders: (r: Role) => r !== 'DEVELOPER',
  team: (r: Role) => r !== 'FINANCE_MANAGER',
  manager: (r: Role) => r === 'SUPER_ADMIN' || r === 'PROJECT_MANAGER',
  editProjects: (r: Role) => Permissions.manager(r),
  admin: (r: Role) => r === 'SUPER_ADMIN',
  seesAllProjects: (r: Role) => r !== 'DEVELOPER',
};

export function requireAccess(allowed: boolean, message: string): void {
  if (!allowed) throw forbidden(message);
}
