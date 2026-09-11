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
];
