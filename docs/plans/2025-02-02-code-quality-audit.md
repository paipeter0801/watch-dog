# Watch-Dog Sentinel Code Quality Audit & Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete code quality audit, improve documentation, add missing comments, and ensure all functionality works as intended.

**Architecture:** Systematic review of all source files, identifying gaps in documentation, comments, and code quality, then implementing fixes.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, D1 SQLite

---

## Audit Summary

### Files Reviewed
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `src/index.tsx` | 1606 | Main entry point, API routes, UI | ✅ Complete |
| `src/services/logic.ts` | 121 | Check processing state machine | ✅ Well documented |
| `src/services/alert.ts` | 325 | Slack alert service | ✅ Well documented |
| `src/services/settings.ts` | 112 | Settings management | ⚠️ Needs comments |
| `src/types.ts` | 66 | TypeScript interfaces | ⚠️ Needs documentation |
| `src/db.sql` | 67 | Database schema | ⚠️ Needs comments |
| `README.md` | 22 | Project readme | ❌ Incomplete |
| `CLAUDE.md` | 102 | Developer guidelines | ✅ Complete |
| `docs/usage.md` | 314 | User guide | ✅ Complete |
| `docs/testing.md` | 58 | Testing checklist | ✅ Complete |

### Audit Findings

#### ✅ Strengths
1. **Type Safety**: Excellent TypeScript usage with proper interfaces
2. **Security**: SQL injection prevention via prepared statements
3. **Code Organization**: Clean separation of concerns (services, types, routes)
4. **API Documentation**: `alert.ts` has comprehensive JSDoc comments
5. **User Documentation**: Complete usage guide in Traditional Chinese

#### ⚠️ Areas for Improvement
1. **File Headers**: Missing file-level documentation headers
2. **Function Comments**: Some functions lack JSDoc comments
3. **README.md**: Too minimal, lacks project overview
4. **DB Schema**: Missing column-level comments
5. **Types File**: Missing interface documentation
6. **Settings Service**: Missing function documentation

#### ❌ Critical Gaps
1. **No API Documentation**: OpenAPI/Swagger spec missing
2. **No Architecture Diagram**: System flow not visualized
3. **No Development Setup Guide**: Local setup steps unclear
4. **No Contributing Guidelines**: PR standards not defined

---

## Task 1: Enhance README.md

**Files:**
- Modify: `README.md`

**Step 1: Replace content with comprehensive README**

```markdown
# Watch-Dog Sentinel

A serverless, passive monitoring system ("Dead Man's Switch") for distributed microservices. Services report heartbeats to the Sentinel, and if they stop reporting, alerts are triggered.

## Features

- **Passive Monitoring**: Services report heartbeats via simple HTTP API
- **Smart Alerting**: Configurable thresholds and cooldowns prevent false alarms
- **Slack Integration**: Rich Block Kit alerts with severity-based channels
- **Maintenance Mode**: Suppress alerts during scheduled maintenance windows
- **Admin Dashboard**: Web UI for managing projects, checks, and settings
- **Self-Monitoring**: Built-in health check for the monitoring system itself

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url>
cd watch-dog
npm install
```

### 2. Configure Environment

Edit `wrangler.toml` with your Cloudflare account details.

### 3. Setup Database

```bash
# Local development
npx wrangler d1 execute watch-dog-db --local --file=src/db.sql

# Production
npx wrangler d1 execute watch-dog-db --file=src/db.sql
```

### 4. Deploy

```bash
npm run deploy
```

### 5. Configure Slack

Visit `https://<your-worker-url>/admin` and configure your Slack settings.

## Usage

See [docs/usage.md](docs/usage.md) for detailed usage instructions and client integration examples.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pulse` | POST | Report heartbeat |
| `/api/config` | PUT | Register project/checks |
| `/api/status` | GET | Get all statuses |
| `/api/status/:projectId` | GET | Get project status |
| `/api/maintenance/:projectId` | POST | Toggle maintenance mode |
| `/admin` | GET | Admin dashboard |

## Development

```bash
# Start local development server
npm run dev

# Type checking
npx tsc --noEmit

# Deploy to production
npm run deploy
```

## Architecture

```
┌─────────────┐     pulse      ┌──────────────────┐
│   Service   │ ──────────────> │  Watch-Dog API  │
└─────────────┘                 └────────┬─────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │  D1 Database │
                                   └──────┬───────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                        ▼                                   ▼
                  ┌─────────┐                         ┌─────────┐
                  │  Cron   │                         │  Slack  │
                  │ (1/min) │                         │ Alerts  │
                  └─────────┘                         └─────────┘
```

## License

MIT
```

**Step 2: Verify markdown formatting**

Run: Visual inspection of the README
Expected: Proper markdown rendering

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: enhance README with project overview and quick start guide"
```

---

## Task 2: Add File Header Documentation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/settings.ts`
- Modify: `src/db.sql`

**Step 1: Add header to `src/types.ts`**

```typescript
/**
 * src/types.ts
 * Type definitions for Watch-Dog Sentinel
 *
 * This file defines all TypeScript interfaces used throughout the application:
 * - Env: Cloudflare Worker environment bindings
 * - Project: Project entity with maintenance state
 * - Check: Check entity with monitoring rules and current state
 * - Log: Historical log entries
 * - PulsePayload, ConfigPayload, CheckConfig: API request types
 *
 * @module types
 */
```

**Step 2: Add header to `src/services/settings.ts`**

```typescript
/**
 * src/services/settings.ts
 * Settings management service for Watch-Dog Sentinel
 *
 * Provides functions to:
 * - Retrieve all settings from the database
 * - Update individual settings
 * - Update all Slack settings atomically
 * - Get settings with environment variable fallback
 *
 * Settings are stored in the `settings` table and include:
 * - Slack API token and channel IDs
 * - Silence period (cooldown) for alerts
 *
 * @module services/settings
 */
```

**Step 3: Add header to `src/db.sql`**

```sql
-- src/db.sql
-- Database schema for Watch-Dog Sentinel
--
-- Tables:
--   - projects: Stores project tokens and maintenance state
--   - checks: Defines monitoring rules and current state
--   - logs: Historical log entries (periodically cleaned)
--   - settings: Admin-configurable settings (Slack, cooldown)
--
-- The schema uses SQLite syntax compatible with Cloudflare D1.
-- All timestamps are stored as Unix timestamps (seconds since epoch).
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types.ts src/services/settings.ts src/db.sql
git commit -m "docs: add file header documentation to types, settings, and db schema"
```

---

## Task 3: Add JSDoc Comments to Types

**Files:**
- Modify: `src/types.ts`

**Step 1: Add JSDoc to all interfaces**

```typescript
/**
 * Cloudflare Worker environment bindings
 *
 * These values are configured in wrangler.toml or Cloudflare dashboard.
 * Some are legacy fallbacks; settings are now primarily stored in DB.
 */
export interface Env {
  /** D1 Database binding */
  DB: D1Database;
  /** @deprecated Use settings table instead */
  SLACK_API_TOKEN: string;
  /** @deprecated Use settings table instead */
  SLACK_CHANNEL_CRITICAL: string;
  /** @deprecated Use settings table instead */
  SLACK_CHANNEL_SUCCESS: string;
  /** @deprecated Use settings table instead */
  SLACK_CHANNEL_WARNING: string;
  /** @deprecated Use settings table instead */
  SLACK_CHANNEL_INFO: string;
  /** @deprecated Use settings table instead */
  SLACK_SILENCE_PERIOD_SECONDS?: string;
}

/**
 * Project entity representing a monitored service
 *
 * Each project has a unique token used for API authentication.
 * Projects can be put into maintenance mode to suppress alerts.
 */
export interface Project {
  /** Unique project identifier (e.g., "my-service") */
  id: string;
  /** Secret token for API authentication */
  token: string;
  /** Human-readable display name */
  display_name: string;
  /** Unix timestamp when maintenance mode ends (0 = not in maintenance) */
  maintenance_until: number;
  /** Unix timestamp when project was created */
  created_at: number;
}

/**
 * Check entity representing a single monitoring rule
 *
 * Checks define the rules for monitoring and track current state.
 * The check ID format is `{project_id}:{check_name}`.
 */
export interface Check {
  /** Unique check ID */
  id: string;
  /** Parent project ID */
  project_id: string;
  /** Check name (unique within project) */
  name: string;
  /** Human-readable display name (null = use name) */
  display_name: string | null;
  /** Check type: heartbeat (periodic) or event (triggered) */
  type: 'heartbeat' | 'event';
  /** Expected interval between pulses (seconds) */
  interval: number;
  /** Grace period beyond interval before considered stale (seconds) */
  grace: number;
  /** Consecutive failures before alerting */
  threshold: number;
  /** Minimum time between alerts (seconds) */
  cooldown: number;
  /** Unix timestamp of last pulse */
  last_seen: number;
  /** Current status: ok, error, or dead */
  status: 'ok' | 'error' | 'dead';
  /** Current consecutive failure count */
  failure_count: number;
  /** Unix timestamp of last alert sent */
  last_alert_at: number;
  /** Last message from pulse (null = none) */
  last_message: string | null;
  /** Whether this check is monitored (1 = enabled, 0 = disabled) */
  monitor: number;
}

// ... similar JSDoc for Log, PulsePayload, CheckConfig, ConfigPayload
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "docs: add JSDoc comments to all type definitions"
```

---

## Task 4: Add JSDoc Comments to Settings Service

**Files:**
- Modify: `src/services/settings.ts`

**Step 1: Add JSDoc to all functions**

```typescript
/**
 * Database setting record
 */
export interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_at: number;
}

/**
 * Slack notification settings
 */
export interface SlackSettings {
  /** Slack Bot Token (xoxb-...) */
  api_token: string;
  /** Channel ID for critical alerts */
  channel_critical: string;
  /** Channel ID for recovery notices */
  channel_success: string;
  /** Channel ID for warning alerts */
  channel_warning: string;
  /** Channel ID for info logs */
  channel_info: string;
}

/**
 * All application settings
 */
export interface AllSettings extends SlackSettings {
  /** Cooldown period between duplicate alerts (seconds) */
  silence_period_seconds: number;
}

/**
 * Get all settings from the database
 *
 * @param db - D1 database instance
 * @returns All settings with defaults for missing values
 *
 * @example
 * const settings = await getAllSettings(db);
 * console.log(settings.api_token);
 */
export async function getAllSettings(db: D1Database): Promise<AllSettings> {
  // ... existing code
}

/**
 * Update a single setting in the database
 *
 * @param db - D1 database instance
 * @param key - Setting key (e.g., "slack_api_token")
 * @param value - New value for the setting
 * @returns true if successful, false on error
 */
export async function updateSetting(db: D1Database, key: string, value: string): Promise<boolean> {
  // ... existing code
}

/**
 * Update all Slack settings atomically
 *
 * @param db - D1 database instance
 * @param settings - Slack settings object with values to update
 * @returns true if successful, false on error
 */
export async function updateSlackSettings(db: D1Database, settings: SlackSettings): Promise<boolean> {
  // ... existing code
}

/**
 * Get settings with environment variable fallback
 *
 * This function provides a fallback to environment variables for
 * backward compatibility. New deployments should use the database.
 *
 * @param db - D1 database instance
 * @param env - Cloudflare Worker environment bindings
 * @returns All settings with env var fallbacks
 */
export async function getEnvWithFallback(db: D1Database, env: Env): Promise<AllSettings> {
  // ... existing code
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/services/settings.ts
git commit -m "docs: add JSDoc comments to settings service functions"
```

---

## Task 5: Add Comments to Database Schema

**Files:**
- Modify: `src/db.sql`

**Step 1: Add column-level comments**

```sql
-- src/db.sql
-- Database schema for Watch-Dog Sentinel
--
-- Tables:
--   - projects: Stores project tokens and maintenance state
--   - checks: Defines monitoring rules and current state
--   - logs: Historical log entries (periodically cleaned)
--   - settings: Admin-configurable settings (Slack, cooldown)

-- ============================================================================
-- Projects Table
-- ============================================================================
-- Each project represents a monitored service with its own authentication token
CREATE TABLE IF NOT EXISTS projects (
    -- Unique project identifier (e.g., "my-service", "api-backend")
    id TEXT PRIMARY KEY,
    -- Secret token for API authentication (min 16 characters recommended)
    token TEXT NOT NULL,
    -- Human-readable display name for UI
    display_name TEXT NOT NULL,
    -- Unix timestamp when maintenance mode ends (0 = not in maintenance)
    maintenance_until INTEGER DEFAULT 0,
    -- Unix timestamp when project was created
    created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- Checks Table
-- ============================================================================
-- Each check defines a monitoring rule and tracks its current state
CREATE TABLE IF NOT EXISTS checks (
    -- Unique check ID in format "{project_id}:{check_name}"
    id TEXT PRIMARY KEY,
    -- Parent project reference
    project_id TEXT NOT NULL,
    -- Check name (unique within project, e.g., "database", "api-health")
    name TEXT NOT NULL,
    -- Optional display name (null = use name)
    display_name TEXT,
    -- Check type: "heartbeat" = periodic checks, "event" = error-triggered
    type TEXT NOT NULL,

    -- ---------- SLA Rules ----------
    -- Expected interval between pulses (seconds)
    interval INTEGER DEFAULT 300,
    -- Grace period beyond interval before stale (seconds)
    grace INTEGER DEFAULT 60,
    -- Consecutive failures before triggering alert
    threshold INTEGER DEFAULT 1,
    -- Minimum time between alerts for same check (seconds)
    cooldown INTEGER DEFAULT 900,

    -- ---------- Current State ----------
    -- Unix timestamp of last received pulse
    last_seen INTEGER DEFAULT 0,
    -- Current status: "ok", "error", or "dead"
    status TEXT DEFAULT 'ok',
    -- Current consecutive failure count
    failure_count INTEGER DEFAULT 0,
    -- Unix timestamp of last alert sent
    last_alert_at INTEGER DEFAULT 0,
    -- Last message from pulse (optional)
    last_message TEXT,

    -- ---------- Monitoring Control ----------
    -- If 0, cron watcher will skip this check (1 = enabled, 0 = disabled)
    monitor INTEGER DEFAULT 1,

    FOREIGN KEY(project_id) REFERENCES projects(id)
);

-- ============================================================================
-- Logs Table
-- ============================================================================
-- Historical log entries, periodically cleaned (7-day retention)
CREATE TABLE IF NOT EXISTS logs (
    -- Auto-incrementing primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Associated check ID
    check_id TEXT NOT NULL,
    -- Status at time of log
    status TEXT NOT NULL,
    -- Optional latency measurement (milliseconds)
    latency INTEGER,
    -- Optional message
    message TEXT,
    -- Unix timestamp when log was created
    created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_checks_project ON checks(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_check_id ON logs(check_id);
CREATE INDEX IF NOT EXISTS idx_checks_monitor_type ON checks(monitor, type) WHERE monitor = 1;

-- ============================================================================
-- Settings Table
-- ============================================================================
-- Application settings stored in database (replaces env vars)
CREATE TABLE IF NOT EXISTS settings (
    -- Unique setting key
    key TEXT PRIMARY KEY,
    -- Setting value (stored as text, numbers parsed as needed)
    value TEXT NOT NULL,
    -- Optional description for UI
    description TEXT,
    -- Unix timestamp of last update
    updated_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- Default Settings
-- ============================================================================
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('slack_api_token', '', 'Slack Bot Token (xoxb-...)'),
    ('slack_channel_info', '', 'Slack Channel ID for Info logs'),
    ('slack_channel_warning', '', 'Slack Channel ID for Warnings'),
    ('slack_channel_success', '', 'Slack Channel ID for Success/Recovery'),
    ('slack_channel_critical', '', 'Slack Channel ID for Critical alerts'),
    ('silence_period_seconds', '3600', 'Cooldown period in seconds for duplicate alerts');
```

**Step 2: Test schema locally**

Run: `npx wrangler d1 execute watch-dog-db --local --file=src/db.sql`
Expected: Tables created successfully

**Step 3: Commit**

```bash
git add src/db.sql
git commit -s "docs: add comprehensive comments to database schema"
```

---

## Task 6: Create API Documentation

**Files:**
- Create: `docs/api.md`

**Step 1: Create API documentation**

```markdown
# Watch-Dog Sentinel API Documentation

Base URL: `https://watch-dog.paipeter-gui.workers.dev`

## Authentication

All API requests require authentication via the `X-Project-Token` header:

```
X-Project-Token: your-project-token-here
```

---

## Endpoints

### POST /api/pulse

Report a heartbeat pulse from a service.

**Request:**
```http
POST /api/pulse
X-Project-Token: your-token
Content-Type: application/json

{
  "check_name": "database-health",
  "status": "ok",
  "message": "Database responding in 12ms",
  "latency": 12
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| check_name | string | Yes | Name of the check |
| status | string | No | "ok" or "error" (default: "ok") |
| message | string | No | Optional message |
| latency | number | No | Latency in milliseconds |

**Response:**
```json
{
  "success": true,
  "check_id": "my-service:database-health",
  "status": "ok",
  "timestamp": 1738464000
}
```

---

### PUT /api/config

Register or update project and check configurations.

**Request:**
```http
PUT /api/config
X-Project-Token: your-token
Content-Type: application/json

{
  "project_id": "my-service",
  "display_name": "My API Service",
  "checks": [
    {
      "name": "health",
      "display_name": "Health Check",
      "type": "heartbeat",
      "interval": 60,
      "grace": 10,
      "threshold": 3,
      "cooldown": 300
    }
  ]
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string | Yes | Unique project identifier |
| display_name | string | Yes | Human-readable name |
| checks | array | Yes | Array of check configurations |

**Check Config Fields:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| name | string | - | Check name |
| display_name | string | - | Display name |
| type | string | - | "heartbeat" or "event" |
| interval | number | 300 | Pulse interval (seconds) |
| grace | number | 60 | Grace period (seconds) |
| threshold | number | 1 | Failures before alert |
| cooldown | number | 900 | Alert cooldown (seconds) |

**Response:**
```json
{
  "success": true,
  "project_id": "my-service",
  "message": "Configuration updated",
  "checks_registered": 1
}
```

---

### GET /api/status

Get all projects and their check statuses.

**Response:**
```json
{
  "projects": [
    {
      "id": "my-service",
      "display_name": "My API Service",
      "maintenance_until": 0,
      "in_maintenance": false,
      "checks": [...]
    }
  ],
  "timestamp": 1738464000
}
```

---

### GET /api/status/:projectId

Get status for a specific project.

**Response:**
```json
{
  "project": {...},
  "checks": [...],
  "timestamp": 1738464000
}
```

---

### POST /api/maintenance/:projectId

Toggle maintenance mode for a project.

**Request:**
```json
{
  "enabled": true,
  "duration": 3600
}
```

**Request Fields:**
| Field | Type | Description |
|-------|------|-------------|
| enabled | boolean | true to enable, false to disable |
| duration | number | Duration in seconds (when enabling) |

**Response:**
```json
{
  "success": true,
  "project_id": "my-service",
  "maintenance_mode": true,
  "maintenance_until": 1738467600
}
```

---

## Error Responses

All endpoints may return error responses:

| Status | Description |
|--------|-------------|
| 400 | Bad Request (invalid JSON, missing fields) |
| 401 | Unauthorized (missing token) |
| 403 | Forbidden (invalid token) |
| 404 | Not Found (check doesn't exist) |
| 500 | Internal Server Error |

**Error Response Format:**
```json
{
  "error": "Error message here"
}
```
```

**Step 2: Commit**

```bash
git add docs/api.md
git commit -m "docs: add comprehensive API documentation"
```

---

## Task 7: Create Development Guide

**Files:**
- Create: `docs/development.md`

**Step 1: Create development guide**

```markdown
# Development Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Wrangler

Copy `wrangler.toml.example` to `wrangler.toml` and configure:

```toml
name = "watch-dog"
main = "src/index.tsx"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "watch-dog-db"
database_id = "your-database-id"

[triggers]
crons = ["* * * * *"]
```

### 3. Create D1 Database

```bash
npx wrangler d1 create watch-dog-db
```

Copy the `database_id` to your `wrangler.toml`.

### 4. Run Migrations

```bash
# Local
npx wrangler d1 execute watch-dog-db --local --file=src/db.sql

# Production
npx wrangler d1 execute watch-dog-db --file=src/db.sql
```

## Local Development

### Start Dev Server

```bash
npm run dev
```

The server runs at `http://localhost:8787`.

### Type Checking

```bash
npx tsc --noEmit
```

### Run Migrations Locally

```bash
npx wrangler d1 execute watch-dog-db --local --file=src/db.sql
```

## Deployment

### Deploy to Production

```bash
npm run deploy
```

### Deploy Specific Environment

```bash
npx wrangler deploy --env production
```

## Testing

### Manual Testing Checklist

See `docs/testing.md` for the full testing checklist.

### API Testing with curl

```bash
# Register a project
curl -X PUT http://localhost:8787/api/config \
  -H "X-Project-Token: test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test",
    "display_name": "Test Project",
    "checks": [{
      "name": "health",
      "display_name": "Health",
      "type": "heartbeat",
      "interval": 60
    }]
  }'

# Send a pulse
curl -X POST http://localhost:8787/api/pulse \
  -H "X-Project-Token: test-token" \
  -H "Content-Type: application/json" \
  -d '{"check_name": "health", "status": "ok"}'
```

## Code Style

- Use TypeScript for all new code
- Follow existing naming conventions (camelCase for variables, PascalCase for types)
- Add JSDoc comments for all exported functions
- Keep functions small and focused
- Use prepared statements for all SQL queries

## Project Structure

```
src/
├── index.tsx          # Main entry point
├── db.sql             # Database schema
├── types.ts           # TypeScript definitions
└── services/
    ├── logic.ts       # Check processing logic
    ├── alert.ts       # Slack alerts
    └── settings.ts    # Settings management
docs/                  # Documentation
```

## Debugging

### View Logs

```bash
npx wrangler tail
```

### Local Database Inspection

```bash
npx wrangler d1 execute watch-dog-db --local --command "SELECT * FROM checks"
```
```

**Step 2: Commit**

```bash
git add docs/development.md
git commit -m "docs: add development guide with setup and testing instructions"
```

---

## Task 8: Verify All Functionality

**Files:**
- Test: Manual testing of all features

**Step 1: Test API Endpoints**

1. **Config Registration**
   ```bash
   curl -X PUT https://watch-dog.paipeter-gui.workers.dev/api/config \
     -H "X-Project-Token: test-token-12345678" \
     -H "Content-Type: application/json" \
     -d '{
       "project_id": "test-verify",
       "display_name": "Verification Test",
       "checks": [{
         "name": "api-health",
         "display_name": "API Health",
         "type": "heartbeat",
         "interval": 300,
         "grace": 60,
         "threshold": 2,
         "cooldown": 600
       }]
     }'
   ```
   Expected: `{"success":true,...}`

2. **Pulse Submission**
   ```bash
   curl -X POST https://watch-dog.paipeter-gui.workers.dev/api/pulse \
     -H "X-Project-Token: test-token-12345678" \
     -H "Content-Type: application/json" \
     -d '{"check_name": "api-health", "status": "ok", "message": "Test"}'
   ```
   Expected: `{"success":true,...}`

3. **Status Retrieval**
   ```bash
   curl https://watch-dog.paipeter-gui.workers.dev/api/status
   ```
   Expected: JSON with projects array

**Step 2: Test Admin Dashboard**

1. Visit `/admin`
   - Settings tab loads and saves
   - Projects tab shows list
   - Checks tab shows project cards
   - New Project modal opens
   - Delete buttons show confirmation

**Step 3: Test Main Dashboard**

1. Visit `/`
   - Stats cards display counts
   - Project cards render correctly
   - Mute buttons work
   - Auto-refresh happens (30s)

**Step 4: Verify Cron Execution**

Check that `watch-dog:self-health` check updates its status.

**Step 5: Document test results**

Create `docs/test-results.md` with findings.

**Step 6: Commit**

```bash
git add docs/test-results.md
git commit -m "test: document functionality verification results"
```

---

## Task 9: Final Code Quality Check

**Files:**
- Review: All source files

**Step 1: Run TypeScript compiler**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 2: Check for console.log statements**

```bash
grep -r "console\.log" src/
```
Expected: Only `console.error` for error logging

**Step 3: Check for TODO comments**

```bash
grep -r "TODO\|FIXME\|XXX" src/
```
Expected: No unresolved TODOs

**Step 4: Verify all functions have JSDoc**

Review each exported function for JSDoc comments.

**Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "refactor: final code quality improvements"
```

---

## Summary

This plan systematically improves code quality through:

1. **Documentation Enhancement**: README, API docs, development guide
2. **Code Comments**: File headers, JSDoc for functions and types
3. **Schema Documentation**: Column-level comments in SQL
4. **Functionality Verification**: Manual testing of all features
5. **Code Quality Check**: TypeScript validation, TODO cleanup

After completion, the project will have:
- ✅ Comprehensive README
- ✅ Complete API documentation
- ✅ Development setup guide
- ✅ JSDoc comments on all public APIs
- ✅ File header documentation
- ✅ Database schema comments
- ✅ Verified functionality
- ✅ Clean codebase (no TODOs, no console.logs)
