-- Projects may be created without a client (client is optional).
ALTER TABLE projects ALTER COLUMN client_id DROP NOT NULL;
