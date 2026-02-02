// src/index.tsx
// Main entry point for Watch-Dog Sentinel - API Routes

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, Project, Check, PulsePayload, ConfigPayload, CheckConfig } from './types';
import { processCheckResult } from './services/logic';

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

/**
 * GET /
 * Health check endpoint
 * Returns a simple status message to confirm the service is running
 */
app.get('/', (c) => {
  return c.text('Watch-Dog Sentinel Active 🟢');
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

// Export the app for Cloudflare Workers
// Note: The scheduled handler will be added in the next task
export default app;
