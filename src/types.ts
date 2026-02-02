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

export interface Env {
  DB: D1Database;
  SLACK_API_TOKEN: string;
  SLACK_CHANNEL_CRITICAL: string;
  SLACK_CHANNEL_SUCCESS: string;
  SLACK_CHANNEL_WARNING: string;
  SLACK_CHANNEL_INFO: string;
  SLACK_SILENCE_PERIOD_SECONDS?: string;
}

export interface Project {
  id: string;
  token: string;
  display_name: string;
  maintenance_until: number;
  created_at: number;
}

export interface Check {
  id: string;
  project_id: string;
  name: string;
  display_name: string | null;
  type: 'heartbeat' | 'event';
  interval: number;
  grace: number;
  threshold: number;
  cooldown: number;
  last_seen: number;
  status: 'ok' | 'error' | 'dead';
  failure_count: number;
  last_alert_at: number;
  last_message: string | null;
  monitor: number; // 1 = enabled, 0 = disabled
}

export interface Log {
  id: number;
  check_id: string;
  status: string;
  latency: number | null;
  message: string | null;
  created_at: number;
}

export interface PulsePayload {
  check_name: string;
  status?: 'ok' | 'error';
  message?: string;
  latency?: number;
}

export interface CheckConfig {
  name: string;
  display_name: string;
  type: 'heartbeat' | 'event';
  interval?: number;
  grace?: number;
  threshold?: number;
  cooldown?: number;
}

export interface ConfigPayload {
  checks: CheckConfig[];
}
