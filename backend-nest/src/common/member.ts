import { Role } from './permissions';

/** A team member as stored. Column aliases make rows match this shape directly. */
export interface Member {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  jobTitle: string;
  department: string;
  initials: string;
  capacityHours: number;
  availability: string;
  active: boolean;
  createdAt: Date;
}

/** Column list for selecting members. Pass a table alias when the query joins other tables. */
export const memberColumns = (alias = '') => {
  const p = alias ? `${alias}.` : '';
  return `${p}id, ${p}name, ${p}username, ${p}email,
  ${p}password_hash AS "passwordHash", ${p}role,
  ${p}job_title AS "jobTitle", ${p}department, ${p}initials,
  ${p}capacity_hours AS "capacityHours", ${p}availability, ${p}active,
  ${p}created_at AS "createdAt"`;
};

export const MEMBER_COLUMNS = memberColumns();
