-- Projects table: manages tokens and global maintenance state
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    display_name TEXT NOT NULL,
    maintenance_until INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Checks table: defines rules and current state
CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT,
    type TEXT NOT NULL,

    -- SLA rules
    interval INTEGER DEFAULT 300,
    grace INTEGER DEFAULT 60,
    threshold INTEGER DEFAULT 1,
    cooldown INTEGER DEFAULT 900,

    -- State
    last_seen INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ok',
    failure_count INTEGER DEFAULT 0,
    last_alert_at INTEGER DEFAULT 0,
    last_message TEXT,

    -- Monitoring control (if false, watcher skips this check)
    monitor INTEGER DEFAULT 1,

    FOREIGN KEY(project_id) REFERENCES projects(id)
);

-- Logs table (periodically cleaned)
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id TEXT NOT NULL,
    status TEXT NOT NULL,
    latency INTEGER,
    message TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_checks_project ON checks(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_check_id ON logs(check_id);

-- Settings table for admin configuration (replaces env vars)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Insert default settings from current env
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('slack_api_token', '', 'Slack Bot Token (xoxb-...)'),
    ('slack_channel_info', '', 'Slack Channel ID for Info logs'),
    ('slack_channel_warning', '', 'Slack Channel ID for Warnings'),
    ('slack_channel_success', '', 'Slack Channel ID for Success/Recovery'),
    ('slack_channel_critical', '', 'Slack Channel ID for Critical alerts'),
    ('silence_period_seconds', '3600', 'Cooldown period in seconds for duplicate alerts');
