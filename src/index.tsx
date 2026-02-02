// src/index.tsx
// Main entry point for Watch-Dog Sentinel - API Routes & Dashboard

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { html } from 'hono/html';
import type { ScheduledEvent } from '@cloudflare/workers-types';
import { Env, Project, Check, PulsePayload, ConfigPayload, CheckConfig } from './types';
import { processCheckResult, findDeadChecks } from './services/logic';
import { getAllSettings, updateSlackSettings, updateSetting } from './services/settings';

// Type for Hono bindings
type AppBindings = {
  DB: D1Database;
  SLACK_API_TOKEN: string;
  SLACK_CHANNEL_CRITICAL: string;
  SLACK_CHANNEL_SUCCESS: string;
  SLACK_CHANNEL_WARNING: string;
  SLACK_CHANNEL_INFO: string;
  SLACK_SILENCE_PERIOD_SECONDS?: string;
};

// Initialize Hono app with proper typing
const app = new Hono<{ Bindings: AppBindings }>();

// Enable CORS for all routes
app.use('*', cors());

// ============================================================================
// JSX UI Components
// ============================================================================

/**
 * Layout component - HTML shell with CDN links for Pico.css, HTMX, Alpine.js
 * @param title - Page title
 * @param content - Main content to render
 */
const Layout = ({ title = 'Watch-Dog Sentinel', content }: { title?: string; content: any }) => html`
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <!-- Pico.css -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
  <!-- HTMX -->
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <!-- Alpine.js -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js"></script>
  <style>
    /* Custom dashboard styles */
    body {
      min-height: 100vh;
      background: #1a1a1a;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .project-card {
      border: 1px solid #333;
      border-radius: 0.5rem;
      padding: 1.25rem;
      background: #242424;
      transition: border-color 0.2s;
    }
    .project-card:hover {
      border-color: #444;
    }
    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .project-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }
    .maintenance-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background: #e67e22;
      color: #fff;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .check-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .check-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #2a2a2a;
      border-radius: 0.375rem;
      border-left: 3px solid;
    }
    .check-item.status-ok {
      border-left-color: #2ecc71;
    }
    .check-item.status-error {
      border-left-color: #e74c3c;
    }
    .check-item.status-dead {
      border-left-color: #7f8c8d;
    }
    .check-name {
      font-weight: 500;
      font-size: 0.9rem;
    }
    .check-meta {
      font-size: 0.75rem;
      color: #888;
      margin-top: 0.125rem;
    }
    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.ok {
      background: rgba(46, 204, 113, 0.2);
      color: #2ecc71;
    }
    .status-badge.error {
      background: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
    }
    .status-badge.dead {
      background: rgba(127, 140, 141, 0.2);
      color: #95a5a6;
    }
    .maintenance-controls {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #333;
    }
    .maintenance-controls button {
      flex: 1;
      padding: 0.375rem 0.5rem;
      font-size: 0.75rem;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .last-updated {
      font-size: 0.75rem;
      color: #888;
    }
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #888;
    }
    .empty-state h3 {
      margin-bottom: 0.5rem;
      color: #aaa;
    }
    [x-cloak] {
      display: none !important;
    }
    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.ok {
      background: rgba(46, 204, 113, 0.2);
      color: #2ecc71;
    }
    .status-badge.error {
      background: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
    }
    .status-badge.dead {
      background: rgba(127, 140, 141, 0.2);
      color: #95a5a6;
    }
    /* Admin dashboard styles */
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
  </style>
</head>
<body>
  <main class="container">
    <header style="margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 1.75rem;">Watch-Dog Sentinel</h1>
          <p style="margin: 0.25rem 0 0 0; color: #888;">Passive Monitoring Dashboard</p>
        </div>
        <div class="header-actions">
          <span class="last-updated" x-data="{ updated: new Date() }" x-init="setInterval(() => updated = new Date(), 1000)">
            Last updated: <span x-text="updated.toLocaleTimeString()"></span>
          </span>
        </div>
      </div>
    </header>
    ${content}
  </main>
  <script>
    // Alpine.js time formatting utility
    document.addEventListener('alpine:init', function() {
      Alpine.magic('time', function() {
        return function(timestamp) {
          if (!timestamp) return 'Never';
          var date = new Date(timestamp * 1000);
          var now = new Date();
          var diff = Math.floor((now.getTime() - date.getTime()) / 1000);

          if (diff < 60) return 'Just now';
          if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
          if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
          return date.toLocaleDateString();
        };
      });
    });
  </script>
</body>
</html>
`;

/**
 * ProjectCard component - Card showing project status and checks
 * @param project - Project data with checks
 */
const ProjectCard = (project: Project & { in_maintenance: boolean; checks: Array<Check & { is_stale: boolean }> }) => html`
<div class="project-card">
  <div class="project-header">
    <h3 class="project-title">${project.display_name}</h3>
    ${project.in_maintenance ? html`<span class="maintenance-badge">🚧 Maintenance</span>` : ''}
  </div>
  <div class="check-list">
    ${project.checks.length === 0 ? html`
      <p style="color: #888; font-size: 0.875rem;">No checks configured</p>
    ` : project.checks.map(check => html`
      <div class="check-item status-${check.status}">
        <div>
          <div class="check-name">${check.display_name || check.name}</div>
          <div class="check-meta">
            ${check.type === 'heartbeat' ? `Every ${check.interval}s` : 'Event'} • Last seen: <span x-data="{}" x-text="$time(${check.last_seen})"></span>
          </div>
          ${check.last_message ? html`<div class="check-meta" style="color: #aaa;">${check.last_message}</div>` : ''}
        </div>
        <span class="status-badge ${check.status}">${check.status}</span>
      </div>
    `)}
  </div>
  <div class="maintenance-controls">
    <button
      hx-post="/api/maintenance/${project.id}"
      hx-vals='{"enabled": true, "duration": 600}'
      hx-get="/"
      hx-target="#main"
      hx-swap="innerHTML"
      class="outline secondary"
    >
      Mute 10m
    </button>
    <button
      hx-post="/api/maintenance/${project.id}"
      hx-vals='{"enabled": false}'
      hx-get="/"
      hx-target="#main"
      hx-swap="innerHTML"
      class="outline contrast"
    >
      ${project.in_maintenance ? 'Unmute' : 'Mute'}
    </button>
  </div>
</div>
`;

/**
 * GET /
 * Dashboard main page
 * Renders the monitoring dashboard with all projects and checks
 * Supports HTMX polling for auto-refresh (every 30s)
 */
app.get('/', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  const isHtmx = c.req.header('HX-Request');

  try {
    // Get all projects
    const projectsResult = await db
      .prepare('SELECT * FROM projects ORDER BY display_name')
      .all<Project>();

    const projects = projectsResult.results;

    // Get all checks
    const checksResult = await db
      .prepare('SELECT * FROM checks ORDER BY project_id, name')
      .all<Check>();

    const checks = checksResult.results;

    // Group checks by project
    const projectsWithChecks = projects.map((project) => ({
      ...project,
      in_maintenance: project.maintenance_until > now,
      checks: checks
        .filter((check) => check.project_id === project.id)
        .map((check) => ({
          ...check,
          is_stale: check.type === 'heartbeat' && (check.last_seen + check.interval + check.grace) < now,
        })),
    }));

    // Calculate overall stats
    const totalChecks = checks.length;
    const okChecks = checks.filter((c) => c.status === 'ok').length;
    const errorChecks = checks.filter((c) => c.status === 'error').length;
    const deadChecks = checks.filter((c) => c.status === 'dead').length;
    const inMaintenance = projects.filter((p) => p.maintenance_until > now).length;

    // Render stats cards (only for full page)
    const statsCards = html`
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
  <div style="background: #2a2a2a; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #3498db;">
    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Total Checks</div>
    <div style="font-size: 1.5rem; font-weight: 600;">${totalChecks}</div>
  </div>
  <div style="background: #2a2a2a; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #2ecc71;">
    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">OK</div>
    <div style="font-size: 1.5rem; font-weight: 600; color: #2ecc71;">${okChecks}</div>
  </div>
  <div style="background: #2a2a2a; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #e74c3c;">
    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Error</div>
    <div style="font-size: 1.5rem; font-weight: 600; color: #e74c3c;">${errorChecks}</div>
  </div>
  <div style="background: #2a2a2a; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #7f8c8d;">
    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Dead</div>
    <div style="font-size: 1.5rem; font-weight: 600; color: #95a5a6;">${deadChecks}</div>
  </div>
  <div style="background: #2a2a2a; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid #e67e22;">
    <div style="font-size: 0.75rem; color: #888; text-transform: uppercase;">Maintenance</div>
    <div style="font-size: 1.5rem; font-weight: 600; color: #e67e22;">${inMaintenance}</div>
  </div>
</div>`;

    // Render project grid
    const projectGrid = projectsWithChecks.length === 0 ? html`
      <div class="empty-state">
        <h3>No projects registered</h3>
        <p>Register a project via the <code>/api/config</code> endpoint to get started.</p>
      </div>
    ` : html`
      <div class="dashboard-grid">
        ${projectsWithChecks.map(p => ProjectCard(p))}
      </div>
    `;

    // HTMX request: only return the project grid (refresh stats via page reload)
    if (isHtmx) {
      return c.html(projectGrid);
    }

    // Full page: stats + grid
    const dashboardContent = html`
${statsCards}
<div id="dashboard" hx-get="/" hx-trigger="every 30s" hx-swap="none" _="on htmx:afterRequest if window.location.hash === '' then location.reload()">
  ${projectGrid}
</div>
    `;

    return c.html(Layout({ content: dashboardContent }));
  } catch (error) {
    console.error('Dashboard error:', error);
    const errorContent = html`
      <div class="empty-state">
        <h3>Error loading dashboard</h3>
        <p>Unable to fetch project data. Please try again.</p>
      </div>
    `;

    if (isHtmx) {
      return c.html(errorContent);
    }

    return c.html(Layout({ content: errorContent }));
  }
});

/**
 * PUT /api/config
 * Register or update project and check configurations
 */
app.put('/api/config', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Get auth token from header
  const token = c.req.header('X-Project-Token');
  if (!token) {
    return c.json({ error: 'Missing X-Project-Token header' }, 401);
  }

  try {
    const body = await c.req.json<ConfigPayload & {
      project_id: string;
      display_name: string;
      slack_webhook?: string;
    }>();

    const { project_id, display_name, slack_webhook, checks } = body;

    // Validate required fields
    if (!project_id || !display_name) {
      return c.json({ error: 'Missing required fields: project_id, display_name' }, 400);
    }

    if (!checks || !Array.isArray(checks)) {
      return c.json({ error: 'Missing or invalid checks array' }, 400);
    }

    // Verify token matches existing project or create new project
    const existingProject = await db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(project_id)
      .first<Project>();

    if (existingProject && existingProject.token !== token) {
      return c.json({ error: 'Invalid token for project' }, 403);
    }

    // Upsert project
    await db
      .prepare(`
        INSERT INTO projects (id, token, display_name, slack_webhook, maintenance_until, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
        ON CONFLICT (id) DO UPDATE SET
          display_name = ?,
          slack_webhook = COALESCE(?, slack_webhook)
      `)
      .bind(project_id, token, display_name, slack_webhook ?? null, now, display_name, slack_webhook ?? null)
      .run();

    // Upsert checks
    for (const checkConfig of checks) {
      const {
        name,
        display_name: checkDisplayName,
        type,
        interval = 300,
        grace = 60,
        threshold = 1,
        cooldown = 900,
      } = checkConfig;

      // Validate check config
      if (!name || !type) {
        continue;
      }

      if (type !== 'heartbeat' && type !== 'event') {
        continue;
      }

      const checkId = `${project_id}:${name}`;

      await db
        .prepare(`
          INSERT INTO checks (
            id, project_id, name, display_name, type,
            interval, grace, threshold, cooldown,
            last_seen, status, failure_count, last_alert_at, last_message
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ok', 0, 0, NULL)
          ON CONFLICT (id) DO UPDATE SET
            display_name = ?,
            type = ?,
            interval = ?,
            grace = ?,
            threshold = ?,
            cooldown = ?
        `)
        .bind(
          checkId,
          project_id,
          name,
          checkDisplayName || name,
          type,
          interval,
          grace,
          threshold,
          cooldown,
          checkDisplayName || name,
          type,
          interval,
          grace,
          threshold,
          cooldown
        )
        .run();
    }

    return c.json({
      success: true,
      project_id,
      message: 'Configuration updated',
      checks_registered: checks.length,
    });
  } catch (error) {
    console.error('Config error:', error);
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

/**
 * POST /api/pulse
 * Receive heartbeat pulse from a service
 */
app.post('/api/pulse', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

  // Get auth token from header
  const token = c.req.header('X-Project-Token');
  if (!token) {
    return c.json({ error: 'Missing X-Project-Token header' }, 401);
  }

  try {
    const body = await c.req.json<PulsePayload & { project_id?: string }>();
    const { project_id: projectIdFromBody, check_name, status = 'ok', message, latency } = body;

    // Try to get project_id from body or derive from token
    let projectId = projectIdFromBody;

    if (!projectId) {
      // Look up project by token
      const project = await db
        .prepare('SELECT id FROM projects WHERE token = ?')
        .bind(token)
        .first<{ id: string }>();

      if (!project) {
        return c.json({ error: 'Invalid token' }, 403);
      }
      projectId = project.id;
    } else {
      // Verify token matches the project
      const project = await db
        .prepare('SELECT token FROM projects WHERE id = ?')
        .bind(projectId)
        .first<{ token: string }>();

      if (!project || project.token !== token) {
        return c.json({ error: 'Invalid token for project' }, 403);
      }
    }

    if (!check_name) {
      return c.json({ error: 'Missing check_name' }, 400);
    }

    const checkId = `${projectId}:${check_name}`;

    // Get check and project
    const check = await db
      .prepare('SELECT * FROM checks WHERE id = ?')
      .bind(checkId)
      .first<Check>();

    if (!check) {
      return c.json({ error: 'Check not found. Register via /api/config first.' }, 404);
    }

    const project = await db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first<Project>();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Process the pulse result
    const newStatus: 'ok' | 'error' | 'dead' = status === 'error' ? 'error' : 'ok';
    const pulseMessage = message || (status === 'error' ? 'Service reported error' : 'Pulse received');

    await processCheckResult(
      db,
      c.env,
      check,
      project,
      newStatus,
      pulseMessage,
      latency ?? 0
    );

    return c.json({
      success: true,
      check_id: checkId,
      status: newStatus,
      timestamp: now,
    });
  } catch (error) {
    console.error('Pulse error:', error);
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

/**
 * POST /api/maintenance/:projectId
 * Toggle maintenance mode for a project
 */
app.post('/api/maintenance/:projectId', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  const projectId = c.req.param('projectId');

  try {
    const body = await c.req.json<{ duration?: number; enabled?: boolean }>();
    const { duration, enabled } = body;

    // Get current project
    const project = await db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first<Project>();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    let newMaintenanceUntil: number;

    if (enabled === false) {
      newMaintenanceUntil = 0;
    } else if (enabled === true) {
      const dur = duration ?? 3600;
      newMaintenanceUntil = now + dur;
    } else if (duration !== undefined) {
      newMaintenanceUntil = now + duration;
    } else {
      if (project.maintenance_until > now) {
        newMaintenanceUntil = 0;
      } else {
        newMaintenanceUntil = now + 3600;
      }
    }

    await db
      .prepare('UPDATE projects SET maintenance_until = ? WHERE id = ?')
      .bind(newMaintenanceUntil, projectId)
      .run();

    const isInMaintenance = newMaintenanceUntil > now;

    return c.json({
      success: true,
      project_id: projectId,
      maintenance_mode: isInMaintenance,
      maintenance_until: isInMaintenance ? newMaintenanceUntil : null,
    });
  } catch (error) {
    console.error('Maintenance error:', error);
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// ============================================================================
// Admin UI Routes
// ============================================================================

/**
 * GET /admin
 * Admin dashboard for managing settings, projects, and checks
 */
app.get('/admin', async (c) => {
  const db = c.env.DB;

  try {
    // Get all settings
    const settings = await getAllSettings(db);

    // Get all projects
    const projectsResult = await db
      .prepare('SELECT * FROM projects ORDER BY display_name')
      .all<Project>();
    const projects = projectsResult.results;

    // Get all checks
    const checksResult = await db
      .prepare('SELECT * FROM checks ORDER BY project_id, name')
      .all<Check>();
    const checks = checksResult.results;

    // Group checks by project
    const projectsWithChecks = projects.map((project) => ({
      ...project,
      checks: checks.filter((check) => check.project_id === project.id),
    }));

    const adminContent = html`
<div x-data="{ openTab: 'settings' }">
  <header style="margin-bottom: 2rem; border-bottom: 1px solid #333; padding-bottom: 1rem;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="margin: 0;">Admin Dashboard</h1>
        <p style="margin: 0.25rem 0 0 0; color: #888;">Manage settings, projects, and checks</p>
      </div>
      <a href="/" class="outline secondary">Back to Dashboard</a>
    </div>
    <nav style="margin-top: 1rem; display: flex; gap: 0.5rem;">
      <button
        @click="openTab = 'settings'"
        :class="openTab === 'settings' ? 'primary' : 'outline secondary'"
      >Settings</button>
      <button
        @click="openTab = 'projects'"
        :class="openTab === 'projects' ? 'primary' : 'outline secondary'"
      >Projects</button>
      <button
        @click="openTab = 'checks'"
        :class="openTab === 'checks' ? 'primary' : 'outline secondary'"
      >Checks</button>
    </nav>
  </header>

  <!-- Settings Tab -->
  <div x-show="openTab === 'settings'" x-cloak>
    <h2>Slack Settings</h2>
    <form hx-post="/admin/settings/slack" hx-swap="outerHTML">
      <div class="grid">
        <label>
          API Token
          <input
            type="text"
            name="api_token"
            value="${settings.api_token}"
            placeholder="xoxb-..."
            required
          />
        </label>
        <label>
          Critical Channel
          <input
            type="text"
            name="channel_critical"
            value="${settings.channel_critical}"
            placeholder="#alerts-critical"
            required
          />
        </label>
        <label>
          Success Channel
          <input
            type="text"
            name="channel_success"
            value="${settings.channel_success}"
            placeholder="#alerts-success"
            required
          />
        </label>
        <label>
          Warning Channel
          <input
            type="text"
            name="channel_warning"
            value="${settings.channel_warning}"
            placeholder="#alerts-warning"
            required
          />
        </label>
        <label>
          Info Channel
          <input
            type="text"
            name="channel_info"
            value="${settings.channel_info}"
            placeholder="#alerts-info"
            required
          />
        </label>
        <label>
          Silence Period (seconds)
          <input
            type="number"
            name="silence_period_seconds"
            value="${settings.silence_period_seconds}"
            min="0"
            step="60"
            required
          />
        </label>
      </div>
      <button type="submit" class="primary">Save Settings</button>
    </form>
  </div>

  <!-- Projects Tab -->
  <div x-show="openTab === 'projects'" x-cloak>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h2>Projects</h2>
      <button
        hx-post="/admin/projects/new-dialog"
        hx-target="#modal-container"
        hx-swap="innerHTML"
        class="primary"
      >New Project</button>
    </div>
    <table class="striped">
      <thead>
        <tr>
          <th>Display Name</th>
          <th>Project ID</th>
          <th>Checks</th>
          <th>Maintenance Until</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${projectsWithChecks.map(p => html`
          <tr>
            <td>${p.display_name}</td>
            <td><code>${p.id}</code></td>
            <td>${p.checks.length}</td>
            <td>${p.maintenance_until > 0 ? new Date(p.maintenance_until * 1000).toLocaleString() : 'Not in maintenance'}</td>
            <td>
              <button
                hx-delete="/admin/projects/${p.id}"
                hx-confirm="Are you sure? This will delete the project and all its checks."
                hx-headers='{"X-Requested-With": "XMLHttpRequest"}'
                hx-on::after-request="if(this.getResponseHeader('X-Deleted') === 'true') window.location.href='/admin'"
                class="outline secondary"
                style="font-size: 0.75rem;"
              >Delete</button>
            </td>
          </tr>
        `)}
      </tbody>
    </table>
  </div>

  <!-- Checks Tab -->
  <div x-show="openTab === 'checks'" x-cloak>
    <h2>All Checks</h2>
    <table class="striped" style="font-size: 0.85rem;">
      <thead>
        <tr>
          <th>Display Name</th>
          <th>Type</th>
          <th>Interval</th>
          <th>Grace</th>
          <th>Threshold</th>
          <th>Cooldown</th>
          <th>Status</th>
          <th>Monitor</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${checks.map(check => html`
          <tr>
            <td>${check.display_name || check.name}</td>
            <td>${check.type}</td>
            <td>${check.interval}s</td>
            <td>${check.grace}s</td>
            <td>${check.threshold}</td>
            <td>${check.cooldown}s</td>
            <td>
              <span class="status-badge ${check.status}">${check.status}</span>
            </td>
            <td style="text-align: center;">
              <input
                type="checkbox"
                ${check.monitor ? 'checked' : ''}
                hx-post="/admin/checks/${check.id}/toggle"
                hx-vals='{"monitor": ${check.monitor ? 0 : 1}}'
                hx-swap="none"
              />
            </td>
            <td>
              <button
                hx-delete="/admin/checks/${check.id}"
                hx-confirm="確認刪除檢查「${check.display_name || check.name}」？此操作無法復原。"
                hx-headers='{"X-Requested-With": "XMLHttpRequest"}'
                hx-on::after-request="if(this.getResponseHeader('X-Deleted') === 'true') window.location.href='/admin'"
                class="outline secondary"
                style="font-size: 0.75rem;"
              >Delete</button>
            </td>
          </tr>
        `)}
      </tbody>
    </table>
  </div>

  <!-- Modal Container -->
  <div id="modal-container"></div>
</div>
    `;

    return c.html(Layout({ title: 'Admin - Watch-Dog Sentinel', content: adminContent }));
  } catch (error) {
    console.error('Admin error:', error);
    const errorContent = html`
      <div class="empty-state">
        <h3>Error loading admin</h3>
        <p>Unable to fetch data. Please try again.</p>
      </div>
    `;
    return c.html(Layout({ title: 'Admin - Watch-Dog Sentinel', content: errorContent }));
  }
});

/**
 * POST /admin/settings/slack
 * Save Slack settings
 */
app.post('/admin/settings/slack', async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.parseBody();
    const {
      api_token,
      channel_critical,
      channel_success,
      channel_warning,
      channel_info,
      silence_period_seconds,
    } = body;

    // Update Slack settings and check for success
    const slackSuccess = await updateSlackSettings(db, {
      api_token: api_token as string,
      channel_critical: channel_critical as string,
      channel_success: channel_success as string,
      channel_warning: channel_warning as string,
      channel_info: channel_info as string,
    });

    if (!slackSuccess) {
      return c.html(html`
        <div style="padding: 1rem; background: #e74c3c; color: white; border-radius: 0.5rem; margin-bottom: 1rem;">
          Failed to save Slack settings. Please try again.
        </div>
      `);
    }

    // Update silence period separately and check for success
    const silenceSuccess = await updateSetting(db, 'silence_period_seconds', silence_period_seconds as string);

    if (!silenceSuccess) {
      return c.html(html`
        <div style="padding: 1rem; background: #e74c3c; color: white; border-radius: 0.5rem; margin-bottom: 1rem;">
          Failed to save silence period. Please try again.
        </div>
      `);
    }

    // Return success message with HTMX redirect
    return c.html(html`
      <div style="padding: 1rem; background: #2ecc71; color: white; border-radius: 0.5rem; margin-bottom: 1rem;">
        Settings saved successfully!
      </div>
      <script>htmx.trigger(document.body, 'reloadAdmin'); setTimeout(() => htmx.ajax('GET', '/admin', {target: 'body', swap: 'outerHTML'}), 500);</script>
    `);
  } catch (error) {
    console.error('Settings save error:', error);
    return c.html(html`
      <div style="padding: 1rem; background: #e74c3c; color: white; border-radius: 0.5rem; margin-bottom: 1rem;">
        Error saving settings. Please try again.
      </div>
    `);
  }
});

/**
 * DELETE /admin/projects/:projectId
 * Delete a project and all its checks
 */
app.delete('/admin/projects/:projectId', async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param('projectId');

  try {
    // Delete all checks for this project first
    const checksResult = await db.prepare('DELETE FROM checks WHERE project_id = ?').bind(projectId).run();

    // Delete the project
    const projectResult = await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();

    // Also delete logs for this project's checks
    const logsResult = await db.prepare("DELETE FROM logs WHERE check_id LIKE ?").bind(`${projectId}:%`).run();

    // Verify that the project was actually deleted
    if (!projectResult.success || projectResult.meta.changes === 0) {
      return c.json({ error: 'Project not found or already deleted' }, 404);
    }

    // Return JSON with custom header for HTMX to handle redirect
    c.header('X-Deleted', 'true');
    return c.json({ success: true, project_id: projectId });
  } catch (error) {
    console.error('Project delete error:', error);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

/**
 * DELETE /admin/checks/:checkId
 * Delete a single check
 */
app.delete('/admin/checks/:checkId', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('checkId');

  try {
    // Delete the check
    const checkResult = await db.prepare('DELETE FROM checks WHERE id = ?').bind(checkId).run();

    // Delete logs for this check
    const logsResult = await db.prepare('DELETE FROM logs WHERE check_id = ?').bind(checkId).run();

    // Verify that the check was actually deleted
    if (!checkResult.success || checkResult.meta.changes === 0) {
      return c.json({ error: 'Check not found or already deleted' }, 404);
    }

    // Return JSON with custom header for HTMX to handle redirect
    c.header('X-Deleted', 'true');
    return c.json({ success: true, check_id: checkId });
  } catch (error) {
    console.error('Check delete error:', error);
    return c.json({ error: 'Failed to delete check' }, 500);
  }
});

/**
 * POST /admin/checks/:checkId/toggle
 * Toggle monitor status for a check
 */
app.post('/admin/checks/:checkId/toggle', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('checkId');

  try {
    const body = await c.req.parseBody();
    const monitorValue = body.monitor as string | number;
    const monitor = monitorValue === '1' || monitorValue === 1 ? 1 : 0;

    await db.prepare('UPDATE checks SET monitor = ? WHERE id = ?').bind(monitor, checkId).run();

    return c.json({ success: true, check_id: checkId, monitor });
  } catch (error) {
    console.error('Check toggle error:', error);
    return c.json({ error: 'Failed to toggle check' }, 500);
  }
});

/**
 * GET /admin/checks/:checkId/edit
 * Show edit form for a check
 */
app.get('/admin/checks/:checkId/edit', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('checkId');

  try {
    const check = await db
      .prepare('SELECT * FROM checks WHERE id = ?')
      .bind(checkId)
      .first<Check>();

    if (!check) {
      return c.html(html`<div>Check not found</div>`);
    }

    return c.html(html`
<div x-data="{ open: true }" x-show="open" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;">
  <div @click.outside="closeModal()" style="background: #242424; padding: 2rem; border-radius: 0.5rem; max-width: 500px; width: 100%;">
    <h3>Edit Check</h3>
    <form hx-post="/admin/checks/${checkId}" hx-target="body" hx-swap="outerHTML">
      <label>
        Display Name
        <input type="text" name="display_name" value="${check.display_name || check.name}" required />
      </label>
      <label>
        Type
        <select name="type">
          <option value="heartbeat" ${check.type === 'heartbeat' ? 'selected' : ''}>Heartbeat</option>
          <option value="event" ${check.type === 'event' ? 'selected' : ''}>Event</option>
        </select>
      </label>
      <label>
        Interval (seconds)
        <input type="number" name="interval" value="${check.interval}" min="10" ${check.type === 'event' ? 'disabled' : ''} />
      </label>
      <label>
        Grace Period (seconds)
        <input type="number" name="grace" value="${check.grace}" min="0" />
      </label>
      <label>
        Threshold (consecutive failures)
        <input type="number" name="threshold" value="${check.threshold}" min="1" />
      </label>
      <label>
        Cooldown (seconds between alerts)
        <input type="number" name="cooldown" value="${check.cooldown}" min="0" />
      </label>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="outline secondary" @click="closeModal()">Cancel</button>
      </div>
    </form>
  </div>
  <script>
    function closeModal() {
      const container = document.getElementById('modal-container');
      if (container) {
        container.innerHTML = '';
      }
    }
  </script>
</div>
    `);
  } catch (error) {
    console.error('Check edit error:', error);
    return c.html(html`<div>Error loading check</div>`);
  }
});

/**
 * POST /admin/checks/:checkId
 * Update a check
 */
app.post('/admin/checks/:checkId', async (c) => {
  const db = c.env.DB;
  const checkId = c.req.param('checkId');

  try {
    const body = await c.req.parseBody();
    const {
      display_name,
      type,
      interval,
      grace,
      threshold,
      cooldown,
    } = body;

    // Parse and validate numeric inputs - use defaults if parsing fails
    const parsedInterval = interval ? Math.max(10, parseInt(interval as string, 10) || 300) : 300;
    const parsedGrace = grace ? Math.max(0, parseInt(grace as string, 10) || 60) : 60;
    const parsedThreshold = threshold ? Math.max(1, parseInt(threshold as string, 10) || 1) : 1;
    const parsedCooldown = cooldown ? Math.max(0, parseInt(cooldown as string, 10) || 900) : 900;

    // Validate type
    const validType = type === 'heartbeat' || type === 'event' ? type : 'heartbeat';

    await db.prepare(`
      UPDATE checks SET
        display_name = ?,
        type = ?,
        interval = ?,
        grace = ?,
        threshold = ?,
        cooldown = ?
      WHERE id = ?
    `).bind(
      display_name,
      validType,
      parsedInterval,
      parsedGrace,
      parsedThreshold,
      parsedCooldown,
      checkId
    ).run();

    // Redirect back to admin page
    return c.redirect('/admin');
  } catch (error) {
    console.error('Check update error:', error);
    return c.html(html`<div>Error updating check</div>`);
  }
});

/**
 * POST /admin/projects/new-dialog
 * Show new project form dialog
 */
app.post('/admin/projects/new-dialog', async (c) => {
  return c.html(html`
<div x-data="{ open: true }" x-show="open" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;">
  <div @click.outside="closeModal()" style="background: #242424; padding: 2rem; border-radius: 0.5rem; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto;">
    <h3>New Project</h3>
    <form hx-post="/admin/projects/new" hx-target="body" hx-swap="outerHTML">
      <label>
        Project ID
        <input type="text" name="project_id" placeholder="my-service" required pattern="[a-z0-9-]+" />
        <small>Lowercase letters, numbers, and hyphens only</small>
      </label>
      <label>
        Display Name
        <input type="text" name="display_name" placeholder="My Service" required />
      </label>
      <label>
        Token
        <input type="text" name="token" placeholder="Generate secure token" required minlength="16" />
        <small>At least 16 characters</small>
      </label>
      <label>
        Slack Webhook (optional)
        <input type="text" name="slack_webhook" placeholder="https://hooks.slack.com/services/..." />
      </label>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button type="submit" class="primary">Create</button>
        <button type="button" class="outline secondary" @click="closeModal()">Cancel</button>
      </div>
    </form>
  </div>
  <script>
    function closeModal() {
      const container = document.getElementById('modal-container');
      if (container) {
        container.innerHTML = '';
      }
    }
  </script>
</div>
  `);
});

/**
 * POST /admin/projects/new
 * Create a new project
 */
app.post('/admin/projects/new', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

  try {
    const body = await c.req.parseBody();
    const {
      project_id,
      display_name,
      token,
      slack_webhook,
    } = body;

    // Validate required fields
    if (!project_id || !display_name || !token) {
      return c.html(html`
        <div style="padding: 1rem; background: #e74c3c; color: white; border-radius: 0.5rem;">
          Missing required fields
        </div>
      `);
    }

    // Check if project already exists
    const existing = await db
      .prepare('SELECT id FROM projects WHERE id = ?')
      .bind(project_id)
      .first();

    if (existing) {
      return c.html(html`
        <div style="padding: 1rem; background: #e74c3c; color: white; border-radius: 0.5rem;">
          Project ID already exists
        </div>
      `);
    }

    // Create the project
    await db.prepare(`
      INSERT INTO projects (id, token, display_name, slack_webhook, maintenance_until, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).bind(
      project_id,
      token,
      display_name,
      slack_webhook || null,
      now
    ).run();

    // Create a default self-check for the project
    const checkId = `${project_id}:self`;
    await db.prepare(`
      INSERT INTO checks (
        id, project_id, name, display_name, type,
        interval, grace, threshold, cooldown,
        last_seen, status, failure_count, last_alert_at, last_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ok', 0, 0, NULL)
    `).bind(
      checkId,
      project_id,
      'self',
      'Self Health',
      'heartbeat',
      300,
      60,
      1,
      900
    ).run();

    // Redirect to admin page
    return c.redirect('/admin');
  } catch (error) {
    console.error('Project create error:', error);
    return c.html(html`
      <div style="padding: 1rem; background: #e74c3c; color: white; border-radius: 0.5rem;">
        Error creating project
      </div>
    `);
  }
});

// ============================================================================
// Status API Routes
// ============================================================================

/**
 * GET /api/status
 * Get all projects and their checks
 */
app.get('/api/status', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

  try {
    const projectsResult = await db
      .prepare('SELECT * FROM projects ORDER BY display_name')
      .all<Project>();

    const projects = projectsResult.results;

    const checksResult = await db
      .prepare('SELECT * FROM checks ORDER BY project_id, name')
      .all<Check>();

    const checks = checksResult.results;

    const projectsWithChecks = projects.map((project) => ({
      ...project,
      in_maintenance: project.maintenance_until > now,
      checks: checks
        .filter((check) => check.project_id === project.id)
        .map((check) => ({
          ...check,
          is_stale: check.type === 'heartbeat' && (check.last_seen + check.interval + check.grace) < now,
        })),
    }));

    return c.json({
      projects: projectsWithChecks,
      timestamp: now,
    });
  } catch (error) {
    console.error('Status error:', error);
    return c.json({ error: 'Failed to fetch status' }, 500);
  }
});

/**
 * GET /api/status/:projectId
 * Get status for a specific project
 */
app.get('/api/status/:projectId', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);
  const projectId = c.req.param('projectId');

  try {
    const project = await db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first<Project>();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    const checksResult = await db
      .prepare('SELECT * FROM checks WHERE project_id = ? ORDER BY name')
      .bind(projectId)
      .all<Check>();

    const checks = checksResult.results.map((check) => ({
      ...check,
      is_stale: check.type === 'heartbeat' && (check.last_seen + check.interval + check.grace) < now,
    }));

    return c.json({
      project: {
        ...project,
        in_maintenance: project.maintenance_until > now,
      },
      checks,
      timestamp: now,
    });
  } catch (error) {
    console.error('Status error:', error);
    return c.json({ error: 'Failed to fetch status' }, 500);
  }
});

/**
 * Cron Trigger Handler
 * Runs every minute to find dead checks and trigger alerts
 */
export const scheduled = async (
  event: ScheduledEvent,
  env: AppBindings,
  ctx: ExecutionContext
): Promise<void> => {
  ctx.waitUntil(
    (async () => {
      const now = Math.floor(Date.now() / 1000);

      try {
        // ===== Self-Monitoring: Watch-Dog monitors itself =====
        const selfCheckId = 'watch-dog:self-health';
        const selfProject = {
          id: 'watch-dog',
          token: '',
          display_name: 'Watch-Dog Sentinel',
          slack_webhook: null,
          maintenance_until: 0,
          created_at: now,
        };

        const selfCheck = await env.DB
          .prepare('SELECT * FROM checks WHERE id = ?')
          .bind(selfCheckId)
          .first<Check>();

        if (selfCheck) {
          // Update self-health with OK status (Cron is running!)
          await env.DB
            .prepare(`
              UPDATE checks SET
                status = 'ok',
                last_seen = ?,
                failure_count = 0,
                last_message = 'Cron heartbeat received'
              WHERE id = ?
            `)
            .bind(now, selfCheckId)
            .run();

          // Log the self-pulse
          await env.DB
            .prepare(`
              INSERT INTO logs (check_id, status, latency, message, created_at)
              VALUES (?, 'ok', 0, ?, ?)
            `)
            .bind(selfCheckId, 'Self-monitoring pulse via Cron', now)
            .run();
        }

        // ===== Find dead checks from other projects =====
        const deadChecks = await findDeadChecks(env.DB, now);

        for (const check of deadChecks) {
          if (check.id === selfCheckId) continue;

          const project = {
            id: check.project_id,
            token: check.token,
            display_name: check.project_name,
            slack_webhook: check.slack_webhook,
            maintenance_until: check.maintenance_until,
            created_at: check.created_at,
          };

          await processCheckResult(
            env.DB,
            env,
            check,
            project,
            'dead',
            `Heartbeat missed! Last seen: ${now - check.last_seen}s ago`
          );
        }

        // Clean old logs (7 days)
        await env.DB
          .prepare('DELETE FROM logs WHERE created_at < ?')
          .bind(now - 604800)
          .run();
      } catch (e) {
        console.error('Cron error:', e);
      }
    })()
  );
};

// Export the app for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled,
};
