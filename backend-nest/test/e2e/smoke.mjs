// End-to-end check of the NestJS API against a real PostgreSQL. Run with: node e2e.mjs
const BASE = process.env.BASE ?? 'http://localhost:8099';
const results = [];
let token = null;

async function call(method, path, body, { raw = false, form = null, auth = true } = {}) {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { status: res.status, data };
}

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  -> ${detail}`}`);
}

const today = new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// 1. Auth
let r = await call('POST', '/api/auth/login', { username: 'test.admin', password: 'wrong' }, { auth: false });
check('login rejects wrong password with 401 and message', r.status === 401 && r.data?.error === 'Invalid email or password', JSON.stringify(r));
r = await call('POST', '/api/auth/login', { username: 'test.admin', password: 'test-password-123' }, { auth: false });
check('login with username succeeds', r.status === 200 && r.data.token, JSON.stringify(r));
token = r.data.token;
const adminId = r.data.member.id;
r = await call('POST', '/api/auth/login', { username: 'admin@example.com', password: 'test-password-123' }, { auth: false });
check('login with email succeeds', r.status === 200, JSON.stringify(r));
r = await call('GET', '/api/workspace', undefined, { auth: false });
check('protected route without token returns 401', r.status === 401 && r.data?.error === 'Sign in to continue', JSON.stringify(r));
r = await call('GET', '/api/auth/me');
check('GET /api/auth/me returns the member', r.status === 200 && r.data.access === 'Super Admin', JSON.stringify(r));

// 2. Team members
r = await call('POST', '/api/members', { name: 'Dev Person', username: 'dev.person', email: 'dev@example.com', password: 'devpassword1', access: 'Developer', jobTitle: 'Engineer', department: 'Engineering', capacityHours: 40 });
check('create developer member (201)', r.status === 201 && r.data.access === 'Developer', JSON.stringify(r));
const devId = r.data?.id;
r = await call('POST', '/api/members', { name: 'Dup', username: 'dev.person', email: 'dup@example.com', password: 'devpassword1', access: 'Developer' });
check('duplicate username returns 409', r.status === 409, JSON.stringify(r));
r = await call('POST', '/api/members', { name: 'PM Person', username: 'pm.person', email: 'pm@example.com', password: 'pmpassword1', access: 'Project Manager', jobTitle: 'PM' });
const pmId = r.data?.id;
r = await call('POST', '/api/members', { name: 'Fin Person', username: 'fin.person', email: 'fin@example.com', password: 'finpassword1', access: 'Finance Manager' });
const finId = r.data?.id;
check('create finance and PM members', !!pmId && !!finId, JSON.stringify(r));
r = await call('PATCH', `/api/members/${devId}`, { availability: 'Busy' });
check('PATCH member availability', r.status === 200 && r.data.status === 'Busy', JSON.stringify(r));

// Sign in as developer, to check role restrictions
const devLogin = await call('POST', '/api/auth/login', { username: 'dev.person', password: 'devpassword1' }, { auth: false });
const devToken = devLogin.data?.token;

// 3. Clients
r = await call('POST', '/api/clients', { name: 'Acme Ltd', industry: 'Retail', contact: 'Jane', email: 'jane@acme.test', phone: '000', city: 'Colombo', stage: 'Won', value: 500000, followUp: plusDays(7) });
check('create client (201)', r.status === 201, JSON.stringify(r));
r = await call('GET', '/api/clients');
const acme = r.data?.find(c => c.name === 'Acme Ltd');
check('client listed with CRM fields for admin', acme && acme.email === 'jane@acme.test' && acme.value === 500000, JSON.stringify(acme));
check('client owner resolves to creator name', acme?.owner === 'Test Admin', acme?.owner);
r = await call('POST', `/api/clients/${acme.id}/notes`, { type: 'Call', text: 'Kickoff call' });
check('add client note (201)', r.status === 201, JSON.stringify(r));
r = await call('GET', '/api/clients');
check('note appears on client', r.data.find(c => c.id === acme.id)?.notes?.[0]?.text === 'Kickoff call', JSON.stringify(r.data?.find(c => c.id === acme.id)?.notes));
r = await call('PATCH', `/api/clients/${acme.id}`, { stage: 'Negotiation', value: 600000 });
check('update client stage and value', r.status === 200, JSON.stringify(r));
r = await call('POST', '/api/clients', { name: 'Bad', contact: 'x', email: 'not-an-email', stage: 'Lead' });
check('invalid email returns 400 with message', r.status === 400 && r.data.error === 'Enter a valid email address', JSON.stringify(r));

// Developer sees clients without CRM details
const devClients = await call('GET', '/api/clients', undefined, { auth: true }).then(async () => {
  const saved = token; token = devToken; const x = await call('GET', '/api/clients'); token = saved; return x;
});
const devAcme = devClients.data?.find(c => c.name === 'Acme Ltd');
check('developer sees client without email or value', devAcme && devAcme.email === '' && devAcme.value === 0 && devAcme.notes.length === 0, JSON.stringify(devAcme));

// 4. Projects
r = await call('POST', '/api/projects', { name: 'Website Revamp', clientId: acme.id, category: 'Software Development', priority: 'High', budget: 250000, start: today, end: plusDays(60) });
check('create project (201)', r.status === 201, JSON.stringify(r));
r = await call('POST', '/api/projects', { name: 'Internal Tool', category: 'Consulting', budget: 50000, start: today, end: plusDays(30) });
check('create project without client (optional client)', r.status === 201, JSON.stringify(r));
r = await call('GET', '/api/projects');
const proj = r.data?.find(p => p.name === 'Website Revamp');
check('project listed with team including creator', proj && proj.team.includes(adminId) && proj.status === 'Planning', JSON.stringify(proj));
r = await call('POST', `/api/projects/${proj.id}/team`, { memberId: devId });
check('assign developer to project (200)', r.status === 200, JSON.stringify(r));
r = await call('POST', `/api/projects/${proj.id}/tasks`, { title: 'Design homepage', assigneeId: devId, due: plusDays(10) });
check('add task (201)', r.status === 201, JSON.stringify(r));
r = await call('POST', `/api/projects/${proj.id}/tasks`, { title: 'Bad assignee', assigneeId: pmId, due: plusDays(10) });
check('assignee must be on team -> 400', r.status === 400 && r.data.error === 'Assignee must be on the project team', JSON.stringify(r));
r = await call('GET', '/api/projects');
const task = r.data.find(p => p.id === proj.id).tasks[0];
r = await call('PATCH', `/api/projects/${proj.id}/tasks/${task.id}`, { status: 'In Progress' });
check('move task status', r.status === 200, JSON.stringify(r));
// Developer moves own project task
token = devToken;
r = await call('PATCH', `/api/projects/${proj.id}/tasks/${task.id}`, { status: 'Review' });
check('developer can move task on assigned project', r.status === 200, JSON.stringify(r));
r = await call('POST', `/api/projects/${proj.id}/tasks`, { title: 'Sneaky', due: plusDays(3) });
check('developer adds task on assigned project', r.status === 201, JSON.stringify(r));
r = await call('GET', '/api/projects');
const internalForDev = r.data?.find(p => p.name === 'Internal Tool');
check('developer does not see unassigned project', !internalForDev, 'visible');
token = (await call('POST', '/api/auth/login', { username: 'test.admin', password: 'test-password-123' }, { auth: false })).data.token;

// 5. Orders
r = await call('POST', '/api/orders', { title: 'Revamp build', clientId: acme.id, projectId: proj.id, service: 'Software Development', amount: 300000, delivery: plusDays(45), spec: 'Full site' });
check('create order (201)', r.status === 201, JSON.stringify(r));
r = await call('GET', '/api/orders');
const order = r.data?.[0];
check('order id uses ORD- sequence', order && /^ORD-\d+$/.test(order.id) && order.status === 'Pending', JSON.stringify(order));
r = await call('PATCH', `/api/orders/${order.id}`, { status: 'Approved' });
check('approve order', r.status === 200, JSON.stringify(r));
r = await call('POST', '/api/orders', { title: 'Bad service', clientId: acme.id, service: 'Not a service', amount: 1, delivery: plusDays(5) });
check('unknown service rejected', r.status === 400 && /Service must be one of/.test(r.data.error), JSON.stringify(r));

// 6. Invoices
r = await call('POST', `/api/orders/${order.id}/invoice`);
check('generate invoice from order (201)', r.status === 201, JSON.stringify(r));
r = await call('GET', '/api/invoices');
const inv = r.data?.find(i => i.orderId === order.id);
check('invoice number uses prefix and sequence', inv && /^INV-\d{4}-\d{4}$/.test(inv.id) && inv.status === 'Draft' && inv.amount === 300000, JSON.stringify(inv));
r = await call('POST', '/api/invoices', { clientId: acme.id, description: 'Consulting hours', amount: 12000, due: plusDays(30), status: 'Draft' });
check('create manual draft invoice', r.status === 201, JSON.stringify(r));
const draft2 = (await call('GET', '/api/invoices')).data.find(i => i.description === 'Consulting hours');
r = await call('DELETE', `/api/invoices/${draft2.id}`);
check('delete draft invoice', r.status === 200, JSON.stringify(r));
r = await call('PATCH', `/api/invoices/${inv.id}`, { status: 'Sent' });
check('send (mark sent) draft invoice', r.status === 200, JSON.stringify(r));
r = await call('DELETE', `/api/invoices/${inv.id}`);
check('sent invoice cannot be deleted -> 409', r.status === 409, JSON.stringify(r));
r = await call('GET', `/api/invoices/${inv.id}/pdf`, undefined, { raw: true });
check('PDF download returns application/pdf', r.status === 200 && r.headers.get('content-type') === 'application/pdf' && r.buf.slice(0, 4).toString() === '%PDF', `${r.status} ${r.headers.get('content-type')}`);
check('PDF has inline disposition with invoice id', (r.headers.get('content-disposition') ?? '').includes(`${inv.id}.pdf`), r.headers.get('content-disposition'));
r = await call('POST', `/api/invoices/${inv.id}/send`);
check('send invoice email endpoint returns emailed flag (mail not configured)', r.status === 200 && r.data.emailed === false, JSON.stringify(r));
r = await call('PATCH', `/api/invoices/${inv.id}`, { status: 'Paid' });
check('record payment marks invoice paid', r.status === 200, JSON.stringify(r));
r = await call('GET', '/api/transactions?page=0&size=10');
const payment = r.data?.items?.find(t => t.category === 'Client Payment' && t.amount === 300000);
check('payment creates income transaction', !!payment && payment.type === 'Income', JSON.stringify(r.data?.items?.slice(0, 2)));
r = await call('PATCH', `/api/invoices/${inv.id}`, { status: 'Paid' });
check('cannot pay an already paid invoice -> 409', r.status === 409, JSON.stringify(r));

// 7. Ledger / transactions
r = await call('POST', '/api/transactions', { type: 'Expense', description: 'Cloud bill', category: 'Cloud Infrastructure', amount: 15000, date: today, projectId: proj.id });
check('record expense linked to project (201)', r.status === 201, JSON.stringify(r));
r = await call('POST', '/api/transactions', { type: 'Income', description: 'Bad', category: 'Salaries', amount: 1 });
check('category must match type', r.status === 400, JSON.stringify(r));
r = await call('GET', '/api/transactions?page=0&size=2');
check('transactions paged with total', r.data.total >= 2 && r.data.items.length === 2 && r.data.size === 2, JSON.stringify({ total: r.data?.total, n: r.data?.items?.length }));

// 8. Subscriptions
r = await call('POST', '/api/subscriptions', { clientId: acme.id, plan: 'Support Retainer', monthlyAmount: 20000, start: today });
check('create subscription (201)', r.status === 201, JSON.stringify(r));
const sub = (await call('GET', '/api/subscriptions')).data.find(s => s.plan === 'Support Retainer');
check('subscription lists client name and next billing = start', sub && sub.clientName === 'Acme Ltd' && sub.nextBilling === today, JSON.stringify(sub));
r = await call('POST', `/api/subscriptions/${sub.id}/bill`);
check('bill subscription (201)', r.status === 201, JSON.stringify(r));
const sub2 = (await call('GET', '/api/subscriptions')).data.find(s => s.plan === 'Support Retainer');
check('billing advances next billing by one month', sub2.nextBilling > today, JSON.stringify(sub2));
r = await call('POST', '/api/subscriptions/bill-due');
check('bill-due returns count (none due now)', r.status === 200 && typeof r.data.invoices === 'number', JSON.stringify(r));
r = await call('PATCH', `/api/subscriptions/${sub.id}`, { status: 'Paused' });
check('pause subscription', r.status === 200, JSON.stringify(r));
r = await call('POST', `/api/subscriptions/${sub.id}/bill`);
check('paused subscription cannot be billed -> 409', r.status === 409, JSON.stringify(r));

// 9. Timesheets and leave
const monday = (() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10); })();
const tuesday = (() => { const d = new Date(monday); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
r = await call('PUT', '/api/timesheets', { weekStart: monday, entries: [{ memberId: adminId, date: tuesday, hours: 7.5 }] });
check('non-integer hours rejected', r.status === 400, JSON.stringify(r));
r = await call('PUT', '/api/timesheets', { weekStart: monday, entries: [{ memberId: adminId, date: tuesday, hours: 7 }] });
check('save timesheet hours (200)', r.status === 200, JSON.stringify(r));
r = await call('GET', `/api/timesheets?weekStart=${monday}`);
check('timesheet read returns saved hours', r.data.some(t => t.memberId === adminId && t.hours === 7), JSON.stringify(r.data));
r = await call('POST', '/api/timesheets/submit', { weekStart: monday });
check('submit timesheet (200)', r.status === 200, JSON.stringify(r));
r = await call('POST', `/api/timesheets/${adminId}/${monday}/decision`, { status: 'Approved' });
check('approve own timesheet (manager/admin allowed)', r.status === 200, JSON.stringify(r));
r = await call('PUT', '/api/timesheets', { weekStart: monday, entries: [{ memberId: adminId, date: tuesday, hours: 3 }] });
check('approved week cannot be changed -> 409', r.status === 409, JSON.stringify(r));
r = await call('POST', '/api/leave', { type: 'Annual', from: plusDays(20), to: plusDays(22) });
check('request leave (201)', r.status === 201, JSON.stringify(r));
const leave = (await call('GET', '/api/leave')).data?.[0];
r = await call('PATCH', `/api/leave/${leave.id}`, { status: 'Approved' });
check('approve leave', r.status === 200, JSON.stringify(r));
r = await call('PATCH', `/api/leave/${leave.id}`, { status: 'Rejected' });
check('leave already decided -> 409', r.status === 409, JSON.stringify(r));

// 10. Documents
const form = new FormData();
form.append('file', new Blob(['hello proposal'], { type: 'text/plain' }), 'proposal.txt');
form.append('category', 'Proposal');
form.append('clientId', acme.id);
form.append('projectId', proj.id);
r = await call('POST', '/api/documents', undefined, { form, raw: false });
check('upload document (201)', r.status === 201, JSON.stringify(r));
const doc = (await call('GET', '/api/documents')).data?.find(d => d.name === 'proposal.txt');
check('document lists size and version 1', doc && doc.version === 1 && doc.size === '1 KB' && doc.versions.length === 1, JSON.stringify(doc));
const form2 = new FormData();
form2.append('file', new Blob(['v2 content here'], { type: 'text/plain' }), 'proposal-v2.txt');
r = await call('POST', `/api/documents/${doc.id}/versions`, undefined, { form: form2 });
check('upload new version (201)', r.status === 201, JSON.stringify(r));
r = await call('GET', `/api/documents/${doc.id}/download?version=1`, undefined, { raw: true });
check('download version 1 returns original bytes', r.status === 200 && r.buf.toString() === 'hello proposal', `${r.status} ${r.buf.toString().slice(0, 40)}`);
r = await call('GET', `/api/documents/${doc.id}/download`, undefined, { raw: true });
check('download current version returns v2 bytes', r.status === 200 && r.buf.toString() === 'v2 content here', `${r.status}`);
check('download sets attachment disposition', (r.headers.get('content-disposition') ?? '').startsWith('attachment'), r.headers.get('content-disposition'));
r = await call('PATCH', `/api/documents/${doc.id}`, { status: 'Signed' });
check('set document status', r.status === 200, JSON.stringify(r));

// 11. Settings and services
r = await call('PATCH', '/api/settings', { companyName: 'AlchemyX Global', billingEmail: 'billing@alchemyx.test', invoiceTemplate: 'Modern', invoicePrefix: 'INV-{YYYY}-' });
check('update settings (200)', r.status === 200, JSON.stringify(r));
r = await call('PATCH', '/api/settings', { invoiceTemplate: 'Fancy' });
check('invalid template rejected', r.status === 400, JSON.stringify(r));
r = await call('GET', '/api/settings');
check('settings echo company name', r.data.company.name === 'AlchemyX Global' && r.data.services.length >= 5, JSON.stringify(r.data?.company));
r = await call('PUT', '/api/settings/services', { services: ['Software Development', 'Consulting', 'Consulting', ' '] });
check('replace service categories dedupes and trims', r.status === 200, JSON.stringify(r));
const svc = (await call('GET', '/api/settings')).data.services;
check('service list is the new set', JSON.stringify(svc) === JSON.stringify(['Software Development', 'Consulting']), JSON.stringify(svc));
await call('PUT', '/api/settings/services', { services: ['Software Development', 'AI Solutions', 'Business Automation', 'Consulting', 'Enterprise Software'] });

// 12. Audit, analytics and workspace
r = await call('GET', '/api/audit?page=0&size=5');
check('audit log readable by Super Admin', r.status === 200 && r.data.items.length > 0, JSON.stringify(r).slice(0, 200));
r = await call('GET', '/api/analytics/finance');
const fin = r.data;
check('finance analytics has 12 months and 3 fiscal years', fin.months?.length === 12 && fin.fiscalYears?.length === 3 && fin.cash?.length === 12, JSON.stringify(fin).slice(0, 200));
check('finance analytics counts the paid invoice as revenue', fin.months.some(m => m.revenue >= 300000), JSON.stringify(fin.months));
check('cash position = income minus expenses (opening 0)', Math.round(fin.cashPosition) === 285000, fin.cashPosition);
r = await call('GET', '/api/workspace');
const ws = r.data;
check('workspace has all sections for admin', ws && ws.clients && ws.projects && ws.orders && ws.invoices && ws.transactions && ws.documents && ws.leaves && ws.audit.length > 0 && ws.settings, Object.keys(ws ?? {}).join(','));
check('workspace capabilities for admin', ws.capabilities.admin && ws.capabilities.finance && ws.capabilities.manager, JSON.stringify(ws.capabilities));
check('workspace today and weekStart present', /^\d{4}-\d{2}-\d{2}$/.test(ws.today) && /^\d{4}-\d{2}-\d{2}$/.test(ws.weekStart), `${ws.today} ${ws.weekStart}`);
const devWs = await (async () => { const saved = token; token = devToken; const x = await call('GET', '/api/workspace'); token = saved; return x; })();
check('developer workspace hides finance and audit, shows team (as Spring did)', devWs.data.invoices.length === 0 && devWs.data.transactions.length === 0 && devWs.data.audit.length === 0 && devWs.data.capabilities.team && !devWs.data.capabilities.finance, JSON.stringify(devWs.data?.capabilities));
const devAudit = await (async () => { const saved = token; token = devToken; const x = await call('GET', '/api/audit'); token = saved; return x; })();
check('developer cannot read audit log (403)', devAudit.status === 403, JSON.stringify(devAudit));
const devOrders = await (async () => { const saved = token; token = devToken; const x = await call('GET', '/api/orders'); token = saved; return x; })();
check('developer cannot view orders (403)', devOrders.status === 403, JSON.stringify(devOrders));

// 13. Password reset (no mail configured: request still returns 200, reset with bad token fails)
r = await call('POST', '/api/auth/forgot-password', { email: 'admin@example.com' }, { auth: false });
check('forgot-password always returns 200', r.status === 200, JSON.stringify(r));
r = await call('POST', '/api/auth/forgot-password', { email: 'nobody@example.com' }, { auth: false });
check('forgot-password for unknown email also 200', r.status === 200, JSON.stringify(r));
r = await call('POST', '/api/auth/reset-password', { token: 'bogus', password: 'newpassword1' }, { auth: false });
check('reset with bogus token -> 400 with message', r.status === 400 && /invalid or has expired/.test(r.data.error), JSON.stringify(r));

// 14. Logout
r = await call('POST', '/api/auth/logout');
check('logout (200)', r.status === 200, JSON.stringify(r));
r = await call('GET', '/api/auth/me');
check('token rejected after logout', r.status === 401, JSON.stringify(r));

const failed = results.filter(x => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Failures:');
  failed.forEach(f => console.log(` - ${f.name}: ${f.detail}`));
  process.exitCode = 1;
}
