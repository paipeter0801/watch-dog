# Admin Settings UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based admin interface for configuring Watch-Dog settings (Slack tokens, channels, projects, checks) without requiring code changes or redeployment.

**Architecture:** Create `/admin` routes with D1-backed settings storage. Settings stored in a new `settings` table replace the need for environment variables. Admin UI provides forms for all configuration.

**Tech Stack:** Hono JSX (SSR), Pico.css forms, Alpine.js for modal handling, D1 database for persistence

---

## Task 1: Create Settings Table in D1

**Files:**
- Modify: `src/db.sql`

**Step 1: Add settings table schema**

Add to `src/db.sql`:

```sql
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
```

**Step 2: Run migration**

```bash
npx wrangler d1 execute watch-dog-db --local --file=src/db.sql
npx wrangler d1 execute watch-dog-db --remote --file=src/db.sql
```

**Step 3: Seed current env values to settings**

```bash
# Get current values and insert into settings
# (This will be done via API after the admin interface is ready)
```

**Step 4: Commit**

```bash
git add src/db.sql
git commit -m "feat: add settings table for admin configuration"
```

---

## Task 2: Create Settings Service Module

**Files:**
- Create: `src/services/settings.ts`

**Step 1: Write settings service**

Create `src/services/settings.ts`:

```typescript
import { Env } from '../types';

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_at: number;
}

export interface SlackSettings {
  api_token: string;
  channel_critical: string;
  channel_success: string;
  channel_warning: string;
  channel_info: string;
}

export interface AllSettings extends SlackSettings {
  silence_period_seconds: string;
}

// Get all settings as a typed object
export async function getAllSettings(db: D1Database): Promise<AllSettings> {
  const result = await db.prepare('SELECT * FROM settings').all<Setting>();
  const settings: Record<string, string> = {
    api_token: '',
    channel_critical: '',
    channel_success: '',
    channel_warning: '',
    channel_info: '',
    silence_period_seconds: '3600',
  };

  for (const row of result.results) {
    const key = row.key.replace('slack_', '').replace('_channel_', 'channel_').replace('_period_seconds', '_seconds');
    settings[key] = row.value;
  }

  return settings as any;
}

// Update a single setting
export async function updateSetting(db: D1Database, key: string, value: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = ?`)
    .bind(key, value, now, value, now)
    .run();
}

// Update all Slack settings at once
export async function updateSlackSettings(db: D1Database, settings: SlackSettings): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const updates = [
    ['slack_api_token', settings.api_token],
    ['slack_channel_critical', settings.channel_critical],
    ['slack_channel_success', settings.channel_success],
    ['slack_channel_warning', settings.channel_warning],
    ['slack_channel_info', settings.channel_info],
  ];

  for (const [key, value] of updates) {
    await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = ?`)
      .bind(key, value || '', now, value || '', now)
      .run();
  }
}

// Get settings for env usage (fallback to env vars if DB empty)
export async function getEnvWithFallback(db: D1Database, env: Env): Promise<AllSettings> {
  const dbSettings = await getAllSettings(db);

  // Fallback to env vars if DB setting is empty
  return {
    api_token: dbSettings.api_token || env.SLACK_API_TOKEN || '',
    channel_critical: dbSettings.channel_critical || env.SLACK_CHANNEL_CRITICAL || '',
    channel_success: dbSettings.channel_success || env.SLACK_CHANNEL_SUCCESS || '',
    channel_warning: dbSettings.channel_warning || env.SLACK_CHANNEL_WARNING || '',
    channel_info: dbSettings.channel_info || env.SLACK_CHANNEL_INFO || '',
    silence_period_seconds: dbSettings.silence_period_seconds || env.SLACK_SILENCE_PERIOD_SECONDS || '3600',
  };
}
```

**Step 2: Commit**

```bash
git add src/services/settings.ts
git commit -m "feat: add settings service module"
```

---

## Task 3: Update Alert Service to Use Database Settings

**Files:**
- Modify: `src/services/alert.ts`
- Modify: `src/services/logic.ts`

**Step 1: Update alert.ts to use settings**

Modify `src/services/alert.ts` to read from settings:

```typescript
// Add at top of file
import { getAllSettings } from './settings';

// Replace env.SLACK_* with settings lookup
export async function sendSlackAlert(
  env: Env,
  db: D1Database,
  level: 'CRITICAL' | 'RECOVERY' | 'WARNING',
  title: string,
  details: string,
  checkId: string
): Promise<void> {
  const settings = await getAllSettings(db);

  const channelMap = {
    'CRITICAL': settings.channel_critical,
    'RECOVERY': settings.channel_success,
    'WARNING': settings.channel_warning,
    'INFO': settings.channel_info,
  };

  const token = settings.api_token;
  if (!token) {
    console.error('Slack API token not configured');
    return;
  }

  const channel = channelMap[level];
  if (!channel) {
    console.error(`Slack channel not configured for level: ${level}`);
    return;
  }

  // ... rest of the function with token and channel variables
}
```

**Step 2: Update logic.ts to use settings**

Modify `src/services/logic.ts` to use silence period from settings:

```typescript
import { getAllSettings } from './settings';

// In processCheckResult function, replace:
const silencePeriod = parseInt(env.SLACK_SILENCE_PERIOD_SECONDS || '3600', 10);

// With:
const settings = await getAllSettings(db);
const silencePeriod = parseInt(settings.silence_period_seconds || '3600', 10);
```

**Step 3: Commit**

```bash
git add src/services/alert.ts src/services/logic.ts
git commit -m "feat: use database settings instead of env vars for Slack config"
```

---

## Task 4: Create Admin API Routes

**Files:**
- Modify: `src/index.tsx`

**Step 1: Add admin API routes**

Add to `src/index.tsx` after the maintenance API route:

```tsx
/**
 * GET /admin
 * Admin dashboard - settings, projects, checks management
 */
app.get('/admin', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

  try {
    const settings = await db.prepare('SELECT * FROM settings ORDER BY key').all();

    // Get all projects with their checks
    const projectsResult = await db.prepare('SELECT * FROM projects ORDER BY display_name').all<Project>();
    const checksResult = await db.prepare('SELECT * FROM checks ORDER BY project_id, name').all<Check>();

    const projectsWithChecks = projectsResult.results.map(p => ({
      ...p,
      checks: checksResult.results.filter(c => c.project_id === p.id),
    }));

    const content = html`
<div class="admin-dashboard">
  <nav>
    <ul>
      <li><strong>⚙️ Settings</strong></li>
    </ul>
    <ul>
      <li><a href="/" class="secondary">← Back to Dashboard</a></li>
    </ul>
  </nav>

  <h2>Settings</h2>
  <form id="slack-settings-form" hx-post="/admin/settings/slack" hx-target="#settings-result" hx-swap="outerHTML">
    <div class="grid">
      <div>
        <label>Slack API Token</label>
        <input type="password" name="api_token" placeholder="xoxb-..." value="${settings.results.find(s => s.key === 'slack_api_token')?.value || ''}">
        <small>Bot token from https://api.slack.com/apps</small>
      </div>
      <div>
        <label>Critical Channel ID</label>
        <input type="text" name="channel_critical" placeholder="C..." value="${settings.results.find(s => s.key === 'slack_channel_critical')?.value || ''}">
      </div>
      <div>
        <label>Success Channel ID</label>
        <input type="text" name="channel_success" placeholder="C..." value="${settings.results.find(s => s.key === 'slack_channel_success')?.value || ''}">
      </div>
      <div>
        <label>Warning Channel ID</label>
        <input type="text" name="channel_warning" placeholder="C..." value="${settings.results.find(s => s.key === 'slack_channel_warning')?.value || ''}">
      </div>
      <div>
        <label>Info Channel ID</label>
        <input type="text" name="channel_info" placeholder="C..." value="${settings.results.find(s => s.key === 'slack_channel_info')?.value || ''}">
      </div>
      <div>
        <label>Silence Period (seconds)</label>
        <input type="number" name="silence_period_seconds" value="${settings.results.find(s => s.key === 'slack_silence_period_seconds')?.value || 3600}">
        <small>How long to wait before alerting again for same issue</small>
      </div>
    </div>
    <button type="submit">Save Slack Settings</button>
  </form>
  <div id="settings-result"></div>

  <hr>

  <h2>Projects</h2>
  <div class="project-list">
    ${projectsWithChecks.map(p => html`
      <article>
        <header>
          <h3>${p.display_name} <small>(${p.id})</small></h3>
          <details>
            <summary>Show Token</summary>
            <code>${p.token}</code>
          </details>
        </header>
        <p>Checks: ${p.checks.length} | Maintenance: ${p.maintenance_until > now ? 'Yes' : 'No'}</p>
        <button class="contrast outline" hx-delete="/admin/projects/${p.id}" hx-confirm="Are you sure? This will delete all checks too.">
          Delete Project
        </button>
      </article>
    `).join('')}
  </div>

  <button hx-post="/admin/projects/new-dialog" class="secondary">+ Add New Project</button>

  <hr>

  <h2>All Checks</h2>
  <table class="striped">
    <thead>
      <tr>
        <th>Project</th>
        <th>Check</th>
        <th>Type</th>
        <th>Interval</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${checksResult.results.map(c => html`
        <tr>
          <td><small>${c.project_id}</small></td>
          <td>${c.display_name || c.name}</td>
          <td>${c.type}</td>
          <td>${c.interval}s</td>
          <td>${c.status}</td>
          <td>
            <button class="outline secondary" hx-get="/admin/checks/${c.id}/edit" hx-target="#modal" hx-modal="#modal">Edit</button>
            <button class="contrast outline" hx-delete="/admin/checks/${c.id}" hx-confirm="Delete this check?">Delete</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Modal for editing -->
  <dialog id="modal">
    <article>
      <header>
        <button class="close-button" _="on click closeModal()">&times;</button>
        <h3>Edit Check</h3>
      </header>
      <div id="modal-content"></div>
    </article>
  </dialog>
</div>
    `;

    return c.html(Layout({ content, title: 'Admin Settings' }));
  } catch (error) {
    console.error('Admin error:', error);
    return c.html(Layout({ content: html`<p>Error loading admin page</p>`, title: 'Admin Error' }));
  }
});

/**
 * POST /admin/settings/slack
 * Save Slack settings
 */
app.post('/admin/settings/slack', async (c) => {
  const db = c.env.DB;
  const body = await c.req.formData();

  const settings = {
    api_token: body.get('api_token')?.toString() || '',
    channel_critical: body.get('channel_critical')?.toString() || '',
    channel_success: body.get('channel_success')?.toString() || '',
    channel_warning: body.get('channel_warning')?.toString() || '',
    channel_info: body.get('channel_info')?.toString() || '',
  };

  await updateSlackSettings(db, settings);

  const silence = body.get('silence_period_seconds')?.toString() || '3600';
  await updateSetting(db, 'slack_silence_period_seconds', silence);

  return c.html(html`<div class="status-ok" style="padding: 1rem; margin-bottom: 1rem;">✓ Settings saved successfully!</div>`);
});

/**
 * DELETE /admin/projects/:projectId
 * Delete a project and its checks
 */
app.delete('/admin/projects/:projectId', async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param('projectId');

  await db.prepare('DELETE FROM checks WHERE project_id = ?').bind(projectId).run();
  await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

  return c.json({ success: true });
});

/**
 * DELETE /admin/checks/:checkId
 * Delete a check
 */
app.delete('/admin/checks/:checkId', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('checkId');

  await db.prepare('DELETE FROM checks WHERE id = ?').bind(checkId).run();

  return c.json({ success: true });
});

/**
 * GET /admin/checks/:checkId/edit
 * Show edit form for a check
 */
app.get('/admin/checks/:checkId/edit', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('checkId');

  const check = await db.prepare('SELECT * FROM checks WHERE id = ?').bind(checkId).first<Check>();

  if (!check) {
    return c.html(html`<p>Check not found</p>`);
  }

  return c.html(html`
<form hx-post="/admin/checks/${checkId}" hx-target="#modal-content">
  <label>Display Name</label>
  <input type="text" name="display_name" value="${check.display_name || ''}" required>

  <label>Type</label>
  <select name="type">
    <option value="heartbeat" ${check.type === 'heartbeat' ? 'selected' : ''}>Heartbeat</option>
    <option value="event" ${check.type === 'event' ? 'selected' : ''}>Event</option>
  </select>

  <label>Interval (seconds)</label>
  <input type="number" name="interval" value="${check.interval}" required>

  <label>Grace (seconds)</label>
  <input type="number" name="grace" value="${check.grace}">

  <label>Threshold</label>
  <input type="number" name="threshold" value="${check.threshold}">

  <label>Cooldown (seconds)</label>
  <input type="number" name="cooldown" value="${check.cooldown}">

  <button type="submit">Save</button>
  <button type="button" _="on click closeModal()">Cancel</button>
</form>
  `);
});

/**
 * POST /admin/checks/:checkId
 * Update a check
 */
app.post('/admin/checks/:checkId', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('projectId');
  const body = await c.req.formData();

  const display_name = body.get('display_name')?.toString();
  const type = body.get('type')?.toString();
  const interval = body.get('interval')?.toString();
  const grace = body.get('grace')?.toString();
  const threshold = body.get('threshold')?.toString();
  const cooldown = body.get('cooldown')?.toString();

  // Update query - implement similar logic to /api/config upsert

  return c.json({ success: true });
});

/**
 * POST /admin/projects/new-dialog
 * Show new project form
 */
app.post('/admin/projects/new-dialog', async (c) => {
  return c.html(html`
<dialog open>
  <article>
    <header>
      <button class="close-button" _="on click closeModal()">&times;</button>
      <h3>Add New Project</h3>
    </header>
    <form hx-post="/admin/projects/new" hx-target="#modal-content">
      <label>Project ID</label>
      <input type="text" name="project_id" placeholder="my-service" required>

      <label>Display Name</label>
      <input type="text" name="display_name" placeholder="My Service" required>

      <label>Token</label>
      <input type="text" name="token" placeholder="secret-token-123" required>

      <button type="submit">Create Project</button>
    </form>
  </article>
</dialog>
  `);
});
```

**Step 2: Commit**

```bash
git add src/index.tsx
git commit -m "feat: add admin UI routes for settings and management"
```

---

## Task 5: Add Admin Styling

**Files:**
- Modify: `src/index.tsx`

**Step 1: Add admin-specific styles**

Add to the `<style>` section in Layout:

```css
.admin-dashboard .grid {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
.admin-dashboard article {
  border: 1px solid #333;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}
.admin-dashboard button.close-button {
  float: right;
}
.admin-dialog dialog {
  border: 1px solid #333;
  border-radius: 0.5rem;
  max-width: 500px;
}
.admin-dialog dialog[open] {
  display: flex;
}
.status-ok {
  color: #2ecc71;
}
.project-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 2rem 0;
}
.project-list article {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #2a2a2a;
  border-radius: 0.375rem;
}
.project-list article header {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.project-list article details {
  font-size: 0.8rem;
}
.project-list article code {
  background: #333;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}
```

**Step 2: Commit**

```bash
git add src/index.tsx
git commit -m "feat: add admin styling"
```

---

## Task 6: Test Admin Interface

**Step 1: Deploy and test**

```bash
npx wrangler deploy
```

**Step 2: Test flows**

1. Visit `/admin` - should load admin page
2. Update Slack settings - save and verify
3. Create a new project - verify token is stored
4. Delete the new project - verify removal
5. Edit an existing check - verify update
6. Verify settings persist across deployments

**Step 3: Commit**

```bash
git commit --allow-empty -m "test: verified admin interface functionality"
```

---

## Summary

This plan implements a complete admin interface for Watch-Dog configuration:

1. **Settings Table** - D1-based storage for all configuration
2. **Settings Service** - Read/write operations with fallback to env vars
3. **Updated Alert/Logic** - Use database settings instead of env vars
4. **Admin API Routes** - CRUD for settings, projects, and checks
5. **Admin UI** - Forms for all configuration with modal dialogs
6. **Testing** - Deploy and verify all functionality

**Total estimated steps:** 18 commits

**Key Design Decisions:**
- Settings stored in D1 (no redeployment needed for config changes)
- Env vars as fallback for backwards compatibility
- Zero Trust auth via Cloudflare Access (no password in code)
- Inline modal dialogs for edit forms (clean UX)
