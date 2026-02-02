import { D1Database } from '@cloudflare/workers-types';
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
    channel_warning: dbSettings.channel_warning || (env as any).SLACK_CHANNEL_WARNING || '',
    channel_info: dbSettings.channel_info || (env as any).SLACK_CHANNEL_INFO || '',
    silence_period_seconds: dbSettings.silence_period_seconds || env.SLACK_SILENCE_PERIOD_SECONDS || '3600',
  };
}
