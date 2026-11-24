// Shapes returned by the AlchemyX ERP API. Dates are ISO (YYYY-MM-DD) unless noted.

export type Role = 'Super Admin' | 'Finance Manager' | 'Project Manager' | 'Developer';
export type Stage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done';
export type OrderStatus = 'Pending' | 'Approved' | 'In Progress' | 'Delivered' | 'Completed' | 'Cancelled';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';
export type DocStatus = 'Draft' | 'In Review' | 'Signed' | 'Archived';
export type DocCategory = 'Proposal' | 'Agreement' | 'Invoice' | 'Specification' | 'NDA';
export type MemberStatus = 'Available' | 'Busy' | 'On Leave';

export interface ClientNote { date: string; type: string; text: string }
export interface Client {
  id: string; name: string; industry: string; contact: string; email: string; phone: string; city: string;
  stage: Stage; value: number; owner: string; followUp: string | null; since: string; notes: ClientNote[];
}

export interface Task { id: string; title: string; status: TaskStatus; assignee: string | null; due: string }
export interface Milestone { id: string; name: string; due: string; amount: number; paid: boolean }
export interface Project {
  id: string; name: string; clientId: string | null; status: ProjectStatus; priority: Priority; budget: number; spent: number;
  start: string; end: string; team: string[]; category: string; tasks: Task[]; milestones: Milestone[];
}

export interface Order {
  id: string; title: string; clientId: string; projectId: string | null; service: string; amount: number;
  status: OrderStatus; created: string; delivery: string; spec: string;
}

export interface Invoice {
  id: string; clientId: string; orderId: string | null; amount: number; issued: string; due: string;
  status: InvoiceStatus; description: string;
}

export interface Subscription {
  id: string; clientId: string; clientName: string; plan: string; monthlyAmount: number;
  start: string; nextBilling: string; status: 'Active' | 'Paused' | 'Cancelled';
}

export interface Txn {
  id: string; date: string; desc: string; category: string; type: 'Income' | 'Expense'; amount: number; projectId: string | null;
}

export interface Member {
  id: string; name: string; role: string; dept: string; email: string; access: Role;
  hours: number; capacity: number; status: MemberStatus; initials: string;
}

export interface DocVersion { version: number; fileName: string; sizeBytes: number; uploadedAt: string; uploadedBy: string }
export interface Doc {
  id: string; name: string; category: DocCategory; clientId: string; projectId: string | null; status: DocStatus;
  version: number; updated: string; size: string; versions: DocVersion[];
}

export interface Leave { id: string; memberId: string; from: string; to: string; type: string; status: 'Pending' | 'Approved' | 'Rejected' }
export interface TimesheetEntry { memberId: string; date: string; hours: number }
export interface Audit { at: string; who: string; what: string }

export interface Capabilities {
  finance: boolean; editFinance: boolean; crm: boolean; editCrm: boolean; orders: boolean; team: boolean;
  manager: boolean; admin: boolean; editProjects: boolean; moveTasks: boolean;
}

export interface Settings {
  company: { name: string; registrationNo: string; billingEmail: string; address: string };
  currency: string;
  fiscalYearStart: 'July' | 'January' | 'April';
  openingCash: number;
  invoicing: { prefix: string; nextNumber: number; template: string; paymentTerms: string; taxLabel: string };
  notifications: { overdue: boolean; newOrder: boolean; leave: boolean; deadline: boolean; weekly: boolean };
  services: string[];
}

export interface Workspace {
  me: Member;
  capabilities: Capabilities;
  today: string;
  weekStart: string;
  members: Member[];
  clients: Client[];
  projects: Project[];
  orders: Order[];
  invoices: Invoice[];
  transactions: Txn[];
  documents: Doc[];
  leaves: Leave[];
  timesheet: TimesheetEntry[];
  audit: Audit[];
  settings: Settings;
}

export interface MonthPoint { month: string; label: string; revenue: number; expenses: number; newClients: number }
export interface FiscalYear { label: string; revenue: number; expenses: number }
export interface CashPoint { label: string; balance: number }
export interface FinanceAnalytics {
  months: MonthPoint[];
  fiscalYears: FiscalYear[];
  cash: CashPoint[];
  cashPosition: number;
  outstanding: number;
  overdue: number;
  recurringLast30Days: number;
  monthlyRecurring: number;
}

export interface TimesheetSubmission { memberId: string; weekStart: string; status: 'Submitted' | 'Approved' | 'Rejected' }
export interface PageResult<T> { items: T[]; total: number; page: number; size: number }
