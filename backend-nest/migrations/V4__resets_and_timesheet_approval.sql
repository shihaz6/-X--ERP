-- Password reset tokens. Only the SHA-256 of the token is stored.
CREATE TABLE password_resets (
    token_hash  CHAR(64)    PRIMARY KEY,
    member_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per member per week that has been submitted for approval.
CREATE TABLE timesheet_submissions (
    member_id     UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    week_start    DATE        NOT NULL,
    status        VARCHAR(10) NOT NULL CHECK (status IN ('Submitted', 'Approved', 'Rejected')),
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by    UUID        REFERENCES members(id) ON DELETE SET NULL,
    decided_at    TIMESTAMPTZ,
    PRIMARY KEY (member_id, week_start)
);
