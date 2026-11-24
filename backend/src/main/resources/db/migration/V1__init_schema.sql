-- AlchemyX ERP - initial schema.
-- No demo or sample business data is inserted. The only rows are configuration:
-- the singleton workspace settings row and the default service categories.

CREATE TABLE workspace_settings (
    id                   INTEGER      PRIMARY KEY CHECK (id = 1),
    company_name         VARCHAR(200) NOT NULL DEFAULT '',
    registration_no      VARCHAR(80)  NOT NULL DEFAULT '',
    billing_email        VARCHAR(200) NOT NULL DEFAULT '',
    registered_address   VARCHAR(400) NOT NULL DEFAULT '',
    default_currency     VARCHAR(3)   NOT NULL DEFAULT 'LKR' CHECK (default_currency IN ('LKR', 'USD', 'EUR')),
    fiscal_year_start    VARCHAR(10)  NOT NULL DEFAULT 'July' CHECK (fiscal_year_start IN ('July', 'January', 'April')),
    opening_cash         NUMERIC(14,2) NOT NULL DEFAULT 0,
    invoice_prefix       VARCHAR(40)  NOT NULL DEFAULT 'INV-{YYYY}-',
    invoice_next_number  INTEGER      NOT NULL DEFAULT 1 CHECK (invoice_next_number > 0),
    invoice_template     VARCHAR(20)  NOT NULL DEFAULT 'Modern' CHECK (invoice_template IN ('Modern', 'Classic', 'Minimal')),
    payment_terms        VARCHAR(30)  NOT NULL DEFAULT 'Net 30',
    tax_label            VARCHAR(30)  NOT NULL DEFAULT 'No tax',
    notify_overdue       BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_new_order     BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_leave         BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_deadline      BOOLEAN      NOT NULL DEFAULT TRUE,
    notify_weekly        BOOLEAN      NOT NULL DEFAULT FALSE
);
INSERT INTO workspace_settings (id) VALUES (1);

CREATE TABLE service_categories (
    name      VARCHAR(100) PRIMARY KEY,
    position  INTEGER      NOT NULL
);
INSERT INTO service_categories (name, position) VALUES
    ('Software Development', 1),
    ('AI Solutions', 2),
    ('Business Automation', 3),
    ('Consulting', 4),
    ('Enterprise Software', 5);

CREATE TABLE members (
    id              UUID         PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(200) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('SUPER_ADMIN', 'FINANCE_MANAGER', 'PROJECT_MANAGER', 'DEVELOPER')),
    job_title       VARCHAR(120) NOT NULL DEFAULT '',
    department      VARCHAR(80)  NOT NULL DEFAULT '',
    initials        VARCHAR(4)   NOT NULL,
    capacity_hours  INTEGER      NOT NULL DEFAULT 40 CHECK (capacity_hours BETWEEN 0 AND 168),
    availability    VARCHAR(20)  NOT NULL DEFAULT 'Available' CHECK (availability IN ('Available', 'Busy')),
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Opaque bearer sessions. Only the SHA-256 hash of the token is stored.
CREATE TABLE sessions (
    token_hash  CHAR(64)    PRIMARY KEY,
    member_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE clients (
    id          UUID          PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    industry    VARCHAR(80)   NOT NULL,
    contact     VARCHAR(120)  NOT NULL,
    email       VARCHAR(200)  NOT NULL,
    phone       VARCHAR(40)   NOT NULL DEFAULT '',
    city        VARCHAR(80)   NOT NULL DEFAULT '',
    stage       VARCHAR(20)   NOT NULL CHECK (stage IN ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')),
    value       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
    owner_id    UUID          REFERENCES members(id) ON DELETE SET NULL,
    follow_up   DATE,
    since       DATE          NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE client_notes (
    id          UUID        PRIMARY KEY,
    client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    note_date   DATE        NOT NULL,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('Meeting', 'Call', 'Email')),
    text        TEXT        NOT NULL,
    created_by  UUID        REFERENCES members(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_notes_client ON client_notes (client_id, created_at DESC);

CREATE TABLE projects (
    id          UUID          PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    client_id   UUID          NOT NULL REFERENCES clients(id),
    category    VARCHAR(100)  NOT NULL,
    status      VARCHAR(20)   NOT NULL CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed')),
    priority    VARCHAR(10)   NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    budget      NUMERIC(14,2) NOT NULL CHECK (budget > 0),
    start_date  DATE          NOT NULL,
    end_date    DATE          NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_projects_client ON projects (client_id);

CREATE TABLE project_team (
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, member_id)
);

CREATE TABLE project_tasks (
    id           UUID         PRIMARY KEY,
    project_id   UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position     INTEGER      NOT NULL,
    title        VARCHAR(200) NOT NULL,
    status       VARCHAR(20)  NOT NULL CHECK (status IN ('Backlog', 'In Progress', 'Review', 'Done')),
    assignee_id  UUID         REFERENCES members(id) ON DELETE SET NULL,
    due_date     DATE         NOT NULL,
    UNIQUE (project_id, position)
);

CREATE TABLE project_milestones (
    id          UUID          PRIMARY KEY,
    project_id  UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position    INTEGER       NOT NULL,
    name        VARCHAR(200)  NOT NULL,
    due_date    DATE          NOT NULL,
    amount      NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    paid        BOOLEAN       NOT NULL DEFAULT FALSE,
    UNIQUE (project_id, position)
);

CREATE SEQUENCE order_seq START 1043;

CREATE TABLE orders (
    id             VARCHAR(20)   PRIMARY KEY,
    title          VARCHAR(200)  NOT NULL,
    client_id      UUID          NOT NULL REFERENCES clients(id),
    project_id     UUID          REFERENCES projects(id) ON DELETE SET NULL,
    service        VARCHAR(100)  NOT NULL,
    amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    status         VARCHAR(20)   NOT NULL CHECK (status IN ('Pending', 'Approved', 'In Progress', 'Delivered', 'Completed', 'Cancelled')),
    created_on     DATE          NOT NULL,
    delivery_date  DATE          NOT NULL,
    spec           TEXT          NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_client ON orders (client_id);

-- Invoice status is stored as Draft | Sent | Paid. "Overdue" is derived from due_on at read time.
CREATE TABLE invoices (
    id           VARCHAR(40)   PRIMARY KEY,
    client_id    UUID          NOT NULL REFERENCES clients(id),
    order_id     VARCHAR(20)   REFERENCES orders(id) ON DELETE SET NULL,
    description  VARCHAR(300)  NOT NULL DEFAULT '',
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    issued_on    DATE          NOT NULL,
    due_on       DATE          NOT NULL,
    status       VARCHAR(10)   NOT NULL CHECK (status IN ('Draft', 'Sent', 'Paid')),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_client ON invoices (client_id);

CREATE TABLE transactions (
    id           UUID          PRIMARY KEY,
    txn_date     DATE          NOT NULL,
    description  VARCHAR(300)  NOT NULL,
    category     VARCHAR(60)   NOT NULL,
    type         VARCHAR(10)   NOT NULL CHECK (type IN ('Income', 'Expense')),
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    project_id   UUID          REFERENCES projects(id) ON DELETE SET NULL,
    invoice_id   VARCHAR(40)   REFERENCES invoices(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_date ON transactions (txn_date);
CREATE INDEX idx_transactions_project ON transactions (project_id);

CREATE TABLE documents (
    id               UUID         PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    category         VARCHAR(20)  NOT NULL CHECK (category IN ('Proposal', 'Agreement', 'Invoice', 'Specification', 'NDA')),
    client_id        UUID         NOT NULL REFERENCES clients(id),
    project_id       UUID         REFERENCES projects(id) ON DELETE SET NULL,
    status           VARCHAR(12)  NOT NULL CHECK (status IN ('Draft', 'In Review', 'Signed', 'Archived')),
    current_version  INTEGER      NOT NULL DEFAULT 1,
    updated_on       DATE         NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_client ON documents (client_id);

CREATE TABLE document_versions (
    id           UUID         PRIMARY KEY,
    document_id  UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version      INTEGER      NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    size_bytes   BIGINT       NOT NULL CHECK (size_bytes >= 0),
    uploaded_by  UUID         REFERENCES members(id) ON DELETE SET NULL,
    uploaded_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (document_id, version)
);

-- File bytes are kept apart from version metadata so listings never load file content.
CREATE TABLE document_blobs (
    version_id  UUID  PRIMARY KEY REFERENCES document_versions(id) ON DELETE CASCADE,
    content     BYTEA NOT NULL
);

CREATE TABLE leave_requests (
    id          UUID        PRIMARY KEY,
    member_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    leave_type  VARCHAR(20) NOT NULL CHECK (leave_type IN ('Annual', 'Sick', 'Personal', 'Unpaid')),
    from_date   DATE        NOT NULL,
    to_date     DATE        NOT NULL,
    status      VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    decided_by  UUID        REFERENCES members(id) ON DELETE SET NULL,
    decided_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (to_date >= from_date)
);
CREATE INDEX idx_leave_status_dates ON leave_requests (status, from_date, to_date);

CREATE TABLE timesheet_entries (
    member_id  UUID    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    work_date  DATE    NOT NULL,
    hours      INTEGER NOT NULL CHECK (hours BETWEEN 0 AND 16),
    PRIMARY KEY (member_id, work_date)
);

-- Append-only audit trail. The application never updates or deletes rows here.
CREATE TABLE audit_log (
    id           BIGSERIAL    PRIMARY KEY,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    member_id    UUID         REFERENCES members(id) ON DELETE SET NULL,
    member_name  VARCHAR(120) NOT NULL,
    action       VARCHAR(300) NOT NULL
);
CREATE INDEX idx_audit_occurred_at ON audit_log (occurred_at DESC);
