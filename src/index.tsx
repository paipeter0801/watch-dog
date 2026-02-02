// src/index.tsx
// Main entry point for Watch-Dog Sentinel - API Routes & Dashboard

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { html } from 'hono/html';
import type { ScheduledEvent } from '@cloudflare/workers-types';
import { Env, Project, Check, PulsePayload, ConfigPayload, CheckConfig } from './types';
import { processCheckResult, findDeadChecks } from './services/logic';

// Type for Hono bindings
type AppBindings = {
  DB: D1Database;
  SLACK_API_TOKEN: string;
  SLACK_CHANNEL_CRITICAL: string;
  SLACK_CHANNEL_SUCCESS: string;
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
      margin-top: 1.5rem;
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
      hx-target="#dashboard"
      hx-swap="outerHTML"
      class="outline secondary"
    >
      Mute 10m
    </button>
    <button
      hx-post="/api/maintenance/${project.id}"
      hx-vals='{"enabled": false}'
      hx-get="/"
      hx-target="#dashboard"
      hx-swap="outerHTML"
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

    // Render dashboard content
    const dashboardContent = html`
<!-- Stats Overview -->
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
</div>

<!-- HTMX Refresh Container -->
<div id="dashboard" hx-get="/" hx-trigger="every 30s" hx-swap="outerHTML">
  ${projectsWithChecks.length === 0 ? html`
    <div class="empty-state">
      <h3>No projects registered</h3>
      <p>Register a project via the <code>/api/config</code> endpoint to get started.</p>
    </div>
  ` : html`
    <div class="dashboard-grid">
      ${projectsWithChecks.map(p => ProjectCard(p))}
    </div>
  `}
</div>
    `;

    // Return full HTML for initial request, or partial for HTMX
    if (isHtmx) {
      return c.html(dashboardContent);
    }

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
 *
 * This endpoint supports auto-registration from clients:
 * - Creates/updates project with provided token
 * - Upserts check definitions (idempotent)
 *
 * Headers:
 *   - X-Project-Token: Authentication token for the project
 *
 * Body:
 *   {
 *     "project_id": "my-service",
 *     "display_name": "My API Service",
 *     "slack_webhook": "https://hooks.slack.com/...",
 *     "checks": [
 *       {
 *         "name": "heartbeat",
 *         "display_name": "Main Health Check",
 *         "type": "heartbeat",
 *         "interval": 300,
 *         "grace": 60,
 *         "threshold": 2,
 *         "cooldown": 900
 *       }
 *     ]
 *   }
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
        continue; // Skip invalid checks
      }

      if (type !== 'heartbeat' && type !== 'event') {
        continue; // Skip invalid check types
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
 *
 * This endpoint is called by monitored services to report their status.
 * It updates the check's last_seen timestamp and processes the result.
 *
 * Headers:
 *   - X-Project-Token: Authentication token for the project
 *
 * Body:
 *   {
 *     "check_name": "heartbeat",
 *     "status": "ok",
 *     "message": "Service running normally",
 *     "latency": 45
 *   }
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
 *
 * When in maintenance mode, alerts are suppressed for all checks in the project.
 *
 * Body:
 *   {
 *     "duration": 3600,  // Duration in seconds (optional)
 *     "enabled": true     // true to enable, false to disable
 *   }
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
      // Explicitly disable maintenance mode
      newMaintenanceUntil = 0;
    } else if (enabled === true) {
      // Explicitly enable maintenance mode
      const dur = duration ?? 3600; // Default 1 hour
      newMaintenanceUntil = now + dur;
    } else if (duration !== undefined) {
      // Toggle: set to now + duration
      newMaintenanceUntil = now + duration;
    } else {
      // Toggle: if currently in maintenance, disable; otherwise enable for 1 hour
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

/**
 * GET /api/status
 * Get all projects and their checks
 *
 * Returns the current status of all monitored projects and checks.
 * This is used by the dashboard to display the monitoring grid.
 */
app.get('/api/status', async (c) => {
  const db = c.env.DB;
  const now = Math.floor(Date.now() / 1000);

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
    // Get project
    const project = await db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .bind(projectId)
      .first<Project>();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Get checks for this project
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
 *
 * A check is considered "dead" when:
 * - It's a heartbeat-type check
 * - last_seen + interval + grace < now
 * - Current status is not already 'dead'
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
        const deadChecks = await findDeadChecks(env.DB, now);

        for (const check of deadChecks) {
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
