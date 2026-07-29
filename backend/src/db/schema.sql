-- ─────────────────────────────────────────────────────────────
--  GHOSTWIRE — SQLite schema (adapted from the PostgreSQL blueprint)
--  UUIDs are generated in the application layer and stored as TEXT.
--  Timestamps are stored as ISO-8601 UTC strings.
-- ─────────────────────────────────────────────────────────────

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Operators (gated access)
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    operator_handle TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_active       INTEGER NOT NULL DEFAULT 1
);

-- OTP verification sessions
CREATE TABLE IF NOT EXISTS otp_sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_code_hash TEXT NOT NULL,
    expires_at    TEXT NOT NULL,
    verified      INTEGER NOT NULL DEFAULT 0,
    attempts      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_user ON otp_sessions(user_id);

-- Audit & query logs (the "feed")
CREATE TABLE IF NOT EXISTS query_logs (
    id             TEXT PRIMARY KEY,
    operator_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    tool_used      TEXT NOT NULL,
    search_query   TEXT NOT NULL,
    results_cached TEXT,
    executed_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_query_logs_operator ON query_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_executed ON query_logs(executed_at);
