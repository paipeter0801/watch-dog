// src/services/logic.ts
// State machine logic for check processing in Watch-Dog Sentinel
//
// Concurrency model (D1 has no transactions across statements):
// - failure_count is incremented in SQL, never from the in-memory object,
//   so concurrent pulses count correctly.
// - Alert sending is guarded by a compare-and-swap on last_alert_at:
//   only the writer that flips it may send, so duplicate/racing runs
//   produce exactly one Slack alert.
// - 'dead' transitions CAS on last_seen AND status: a pulse that arrived
//   after findDeadChecks fetched the row is never clobbered, and two
//   overlapping cron runs mark dead at most once.

import { D1Database } from '@cloudflare/workers-types';
import { Check, Project } from '../types';
import { dispatchAlert, isInSilencePeriod, getSilencePeriod } from './alert';

// Claim the alert slot via CAS on last_alert_at: only the writer that flips
// it may send, so concurrent pulses / overlapping runs yield exactly one
// Slack alert (recovery and error paths share this claim). The SQL stays a
// single inline literal per the §B guard (no const indirection).
const claimAlertSlot = (db: D1Database, check: Check, now: number) =>
  db
    .prepare('UPDATE checks SET last_alert_at = ? WHERE id = ? AND last_alert_at = ?')
    .bind(now, check.id, check.last_alert_at)
    .run();

// ===== Email escalation (2026-09-10 incident) =====
// An error episode becomes email-worthy after ESCALATION_THRESHOLD error
// pulses within ESCALATION_WINDOW_SECONDS. Keyed on log history (append-only)
// rather than checks.failure_count: when one check multiplexes several jobs
// (e.g. ek-gateway pulsing all jobs into "jobs"), interleaved ok pulses from
// healthy jobs reset failure_count to 0 every couple of minutes — a
// consecutive counter would never fire while a real incident is ongoing
// (ek-gateway flap: failure_count oscillated 0↔1 for 45 minutes).
const ESCALATION_WINDOW_SECONDS = 900;
const ESCALATION_THRESHOLD = 3;

/** Count error log rows for a check inside the escalation window. */
const countRecentErrors = (db: D1Database, checkId: string, now: number) =>
  db
    .prepare(
      `SELECT COUNT(*) AS n FROM logs
      WHERE check_id = ? AND status = 'error' AND created_at >= ?`
    )
    .bind(checkId, now - ESCALATION_WINDOW_SECONDS)
    .first<{ n: number }>()
    .then((row) => row?.n ?? 0);

export async function processCheckResult(
  db: D1Database,
  check: Check,
  project: Project,
  newStatus: 'ok' | 'error' | 'dead',
  message: string,
  latency: number = 0
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const globalSilence = await getSilencePeriod(db);
  // A per-check cooldown overrides the global silence period when set.
  const silencePeriod = check.cooldown > 0 ? check.cooldown : globalSilence;

  const writeLog = () =>
    db
      .prepare(
        `INSERT INTO logs (check_id, status, latency, message, created_at)
        VALUES (?, ?, ?, ?, ?)`
      )
      .bind(check.id, newStatus, latency, message, now)
      .run();

  if (newStatus === 'ok') {
    // Recovery: previously failed and past its threshold.
    const shouldRecover = check.status !== 'ok' && check.failure_count >= check.threshold;

    // ===== Recovery email gating (fix A) =====
    // The email channel is page-worthy only: a recovery emails when the
    // episode was DEAD (critical level) or had escalated (sustained errors).
    // Recovering from a plain warning never emails — that was the
    // orphan-recovery bug (operators got "recovered" for failures they were
    // never told about, because warnings are Slack-only).
    // An escalated episode resolves only when the error window has drained:
    // interleaved ok pulses from healthy jobs sharing the check must not
    // "resolve" an incident that is still erroring. CAS on the flag makes
    // the resolution fire exactly once.
    let sendRecoveryEmail = check.status === 'dead';
    let resolveEpisode = false;
    if (check.escalated === 1) {
      const recentErrors = await countRecentErrors(db, check.id, now);
      if (recentErrors === 0) {
        const release = await db
          .prepare('UPDATE checks SET escalated = 0 WHERE id = ? AND escalated = 1')
          .bind(check.id)
          .run();
        resolveEpisode = (release.meta.changes ?? 0) === 1;
        sendRecoveryEmail = sendRecoveryEmail || resolveEpisode;
      }
    }

    // Claim the recovery alert first: concurrent ok pulses after a failure
    // streak must yield exactly one alert.
    let sendRecovery = false;
    if (shouldRecover) {
      const claim = await claimAlertSlot(db, check, now);
      sendRecovery = (claim.meta.changes ?? 0) === 1;
    }

    await db
      .prepare(
        `UPDATE checks SET
          status = 'ok',
          last_seen = ?,
          failure_count = 0,
          last_message = ?
        WHERE id = ?`
      )
      .bind(now, message, check.id)
      .run();

    await writeLog();

    if (sendRecovery || resolveEpisode) {
      await dispatchAlert(db, {
        checkId: check.id,
        projectName: project.display_name,
        checkName: check.display_name || check.name,
        level: 'recovery',
        title: 'Service Recovered',
        message,
        metadata: {
          Threshold: check.threshold,
          Interval: `${check.interval}s`,
          Grace: `${check.grace}s`,
        },
        emailWorthy: sendRecoveryEmail,
      });
    }
    return;
  }

  // ----- error / dead -----

  // Projection for the alert decision only; the stored failure_count is
  // incremented atomically in SQL below.
  const projectedFailures = check.failure_count + 1;
  const inMaintenance = project.maintenance_until > now;
  const hitThreshold = projectedFailures >= check.threshold;
  const outsideSilence = !isInSilencePeriod(check.last_alert_at, silencePeriod, now);
  let wantsAlert = !inMaintenance && hitThreshold && outsideSilence;

  // ===== Escalation: sustained errors reach the email channel =====
  // Sliding-window count from the logs (this pulse makes it sustainedCount).
  // Deliberately NOT gated on the silence period: interleaved ok pulses keep
  // resetting last_alert_at via recovery claims — exactly the incident shape
  // where a human still needs to be paged. Dedup: CAS on the escalated flag
  // → one escalation email per episode (no re-nag while the flag is set).
  let escalate = false;
  let sustainedCount = 0;
  if (newStatus === 'error' && !inMaintenance && check.escalated === 0) {
    sustainedCount = (await countRecentErrors(db, check.id, now)) + 1;
    if (sustainedCount >= ESCALATION_THRESHOLD) {
      const claim = await db
        .prepare('UPDATE checks SET escalated = 1 WHERE id = ? AND escalated = 0')
        .bind(check.id)
        .run();
      escalate = (claim.meta.changes ?? 0) === 1;
    }
  }

  if (newStatus === 'dead') {
    // CAS on last_seen (a fresher pulse won the race — bail out entirely;
    // the pulse records its own event) and on status != 'dead' (another
    // cron run already marked it). last_seen is NOT advanced: the public
    // feed must keep showing when the service was actually last heard from.
    const res = await db
      .prepare(
        `UPDATE checks SET
          status = 'dead',
          failure_count = failure_count + 1,
          last_alert_at = ?,
          last_message = ?
        WHERE id = ? AND last_seen = ? AND status != 'dead'`
      )
      .bind(wantsAlert ? now : check.last_alert_at, message, check.id, check.last_seen)
      .run();

    if ((res.meta.changes ?? 0) === 0) {
      return;
    }
  } else {
    // Claim the alert before sending; the state update itself is unconditional.
    if (wantsAlert) {
      const claim = await claimAlertSlot(db, check, now);
      if ((claim.meta.changes ?? 0) === 0) {
        wantsAlert = false; // a racing writer already alerted
      }
    }

    await db
      .prepare(
        `UPDATE checks SET
          status = 'error',
          last_seen = ?,
          failure_count = failure_count + 1,
          last_message = ?
        WHERE id = ?`
      )
      .bind(now, message, check.id)
      .run();
  }

  await writeLog();

  // Escalation dispatches even when the silence period suppressed the plain
  // warning (see above) — that suppression is how a sustained incident could
  // previously page nobody.
  if (wantsAlert || escalate) {
    const title =
      newStatus === 'dead' ? 'Service DEAD' : escalate ? 'Service Warning — Sustained' : 'Service Warning';
    const level = newStatus === 'dead' ? 'critical' : 'warning';

    await dispatchAlert(db, {
      checkId: check.id,
      projectName: project.display_name,
      checkName: check.display_name || check.name,
      level,
      title,
      message: escalate
        ? `${message} (sustained: ${sustainedCount} errors in ${ESCALATION_WINDOW_SECONDS / 60}min — escalated to email)`
        : `${message} (Failures: ${projectedFailures})`,
      metadata: {
        Failures: projectedFailures,
        Threshold: check.threshold,
        Interval: `${check.interval}s`,
        Grace: `${check.grace}s`,
      },
      emailWorthy: escalate || newStatus === 'dead',
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
    .all<Check & { project_name: string; maintenance_until: number; token: string; created_at: number }>();

  return result.results;
}
