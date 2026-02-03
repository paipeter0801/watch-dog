// src/services/logic.ts
// State machine logic for check processing in Watch-Dog Sentinel

import { D1Database } from '@cloudflare/workers-types';
import { Env, Check, Project } from '../types';
import { sendSlackAlert, isInSilencePeriod, getSilencePeriod } from './alert';

export async function processCheckResult(
  db: D1Database,
  env: Env,
  check: Check,
  project: Project,
  newStatus: 'ok' | 'error' | 'dead',
  message: string,
  latency: number = 0
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const silencePeriod = await getSilencePeriod(db);

  let failureCount = check.failure_count;
  let lastAlertAt = check.last_alert_at;
  let shouldAlert = false;
  let alertLevel: 'critical' | 'recovery' | 'warning' = 'critical';

  // 1. Status determination logic
  if (newStatus === 'ok') {
    // Recovery: if previously failed and threshold was met
    if (check.status !== 'ok' && failureCount >= check.threshold) {
      alertLevel = 'recovery';
      shouldAlert = true;
      lastAlertAt = now;
    }
    failureCount = 0;
  } else {
    // Error or Dead
    failureCount += 1;

    // Check if should alert:
    // A. Not in maintenance mode
    // B. Failure count >= threshold
    // C. Outside silence period
    const inMaintenance = project.maintenance_until > now;
    const hitThreshold = failureCount >= check.threshold;
    const outsideSilence = !isInSilencePeriod(lastAlertAt, silencePeriod, now);

    if (!inMaintenance && hitThreshold && outsideSilence) {
      // Use 'warning' for error state, 'critical' for dead state
      alertLevel = newStatus === 'dead' ? 'critical' : 'warning';
      shouldAlert = true;
      lastAlertAt = now;
    }
  }

  // 2. Update database
  await db
    .prepare(
      `UPDATE checks SET
        status = ?,
        last_seen = ?,
        failure_count = ?,
        last_alert_at = ?,
        last_message = ?
      WHERE id = ?`
    )
    .bind(newStatus, now, failureCount, lastAlertAt, message, check.id)
    .run();

  // 3. Write log
  await db
    .prepare(
      `INSERT INTO logs (check_id, status, latency, message, created_at)
      VALUES (?, ?, ?, ?, ?)`
    )
    .bind(check.id, newStatus, latency, message, now)
    .run();

  // 4. Send notification
  if (shouldAlert) {
    const title = newStatus === 'dead'
      ? 'Service DEAD'
      : newStatus === 'error'
      ? 'Service Warning'
      : 'Service Recovered';

    await sendSlackAlert(db, env, {
      checkId: check.id,
      projectName: project.display_name,
      checkName: check.display_name || check.name,
      level: alertLevel,
      title,
      message: `${message} (Failures: ${failureCount})`,
      metadata: {
        Failures: failureCount,
        Threshold: check.threshold,
        Interval: `${check.interval}s`,
        Grace: `${check.grace}s`,
      },
    });
  }
}

export async function findDeadChecks(
  db: D1Database,
  now: number
): Promise<Array<Check & { project_name: string; maintenance_until: number; token: string; created_at: number }>> {
  const result = await db
    .prepare(
      `SELECT c.*, p.display_name as project_name, p.maintenance_until, p.token, p.created_at
      FROM checks c
      JOIN projects p ON c.project_id = p.id
      WHERE c.type = 'heartbeat'
      AND c.status != 'dead'
      AND c.monitor = 1
      AND (c.last_seen + c.interval + c.grace) < ?`
    )
    .bind(now)
    .all();

  return result.results as any;
}
