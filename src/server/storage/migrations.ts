/** Append migrations; never change an already released entry. Applied atomically at startup. */
export const migrations = [
  {
    version: 1,
    sql: `CREATE TABLE learners (
      owner_hash TEXT PRIMARY KEY,
      revision INTEGER NOT NULL CHECK (revision >= 0),
      state TEXT NOT NULL CHECK (json_valid(state)),
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX learners_expiry ON learners(expires_at);`,
  },
  {
    version: 2,
    sql: `CREATE TABLE inference_requests (
      id TEXT PRIMARY KEY,
      owner_hash TEXT REFERENCES learners(owner_hash) ON DELETE SET NULL,
      request_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      day TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
      lease_until INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      provider_request_id TEXT,
      usage_unknown INTEGER NOT NULL DEFAULT 1 CHECK (usage_unknown IN (0, 1)),
      created_at INTEGER NOT NULL,
      UNIQUE(owner_hash, request_id)
    ) STRICT;
    CREATE INDEX inference_owner_day ON inference_requests(owner_hash, day);
    CREATE INDEX inference_day ON inference_requests(day);
    CREATE INDEX inference_owner_lease ON inference_requests(owner_hash, status, lease_until);
    CREATE TRIGGER inference_forget AFTER UPDATE OF owner_hash ON inference_requests
    WHEN NEW.owner_hash IS NULL BEGIN
      UPDATE inference_requests SET fingerprint = '', request_id = '', provider_request_id = NULL,
        input_tokens = 0, output_tokens = 0, usage_unknown = 1 WHERE id = NEW.id;
    END;`,
  },
];
