-- Recurring client subscriptions. Each active subscription is billed monthly.
CREATE TABLE subscriptions (
    id                 UUID          PRIMARY KEY,
    client_id          UUID          NOT NULL REFERENCES clients(id),
    plan               VARCHAR(120)  NOT NULL,
    monthly_amount     NUMERIC(14,2) NOT NULL CHECK (monthly_amount > 0),
    start_date         DATE          NOT NULL,
    next_billing_date  DATE          NOT NULL,
    status             VARCHAR(12)   NOT NULL CHECK (status IN ('Active', 'Paused', 'Cancelled')),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_status ON subscriptions (status, next_billing_date);
