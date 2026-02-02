Here is the `CLAUDE.md` file, written in English with a professional, engineering-focused tone. It encapsulates our entire strategy, the specific architecture (Passive Monitoring), and critical reminders for the Cloudflare/Hono ecosystem.

---

```markdown
# CLAUDE.md - Watch-Dog Sentinel Guidelines

## Project Overview
**Watch-Dog Sentinel** is a serverless, passive monitoring system ("Dead Man's Switch") designed to centralize health checks for distributed microservices. It operates on an "Inversion of Control" model: services report heartbeats ("pulses") to the Sentinel. If a heartbeat is missed, the Sentinel triggers an alert.

## Tech Stack
- **Runtime:** Cloudflare Workers
- **Framework:** Hono (v4+)
- **Database:** Cloudflare D1 (SQLite)
- **Frontend:** Server-Side Rendering (SSR) via Hono JSX
- **Client-Side:** HTMX (for polling/partial updates), Alpine.js (for minor interactions), Pico.css (styling).
- **Language:** TypeScript

## Architecture & Core Concepts
1.  **Passive Monitoring:** The system does not actively probe targets via HTTP. It waits for incoming `POST /pulse` requests.
2.  **The Watcher (Cron):** A Cloudflare Cron Trigger runs every minute to query D1 for checks that have exceeded `last_seen + interval + grace_period`.
3.  **State Machine:**
    - `OK`: Pulse received recently.
    - `ERROR`: Pulse received with error status.
    - `DEAD`: No pulse received within the expected window.
4.  **Smart Alerting:** Implements "Thresholds" (count failures before alerting) and "Cooldowns" (avoid spamming).
5.  **Maintenance Mode:** Supports global and project-level "Hush Mode" to suppress alerts during scheduled maintenance.

## Implementation Guidelines

### 1. Cloudflare Workers & Hono Specifics
-   **Entry Point:** The default export must include both `fetch` (for Hono HTTP) and `scheduled` (for Cron Triggers).
    ```typescript
    export default {
      fetch: app.fetch,
      scheduled: async (event, env, ctx) => { /* logic */ }
    }
    ```
-   **Environment Bindings:** Access D1 via `env.DB` (defined in `wrangler.toml`). Ensure types are defined in `Bindings`.
-   **Async Context:** In the `scheduled` handler, **always** use `ctx.waitUntil(promise)` to ensure the worker doesn't terminate before DB operations complete.
-   **No KV:** Do not use Workers KV for registry/check storage. Use D1 for all state and querying to minimize costs and maximize query flexibility.

### 2. Database (D1)
-   **Schema:** Use `src/db.sql` as the source of truth.
-   **Queries:** Use prepared statements (`stmt.bind()`) to prevent SQL injection.
-   **Optimization:** Create indexes on `project_id` and `check_id` to speed up the Cron loop.

### 3. Frontend (Dashboard)
-   **No Build Step:** Use CDN links for HTMX, Alpine, and Pico.css.
-   **SSR:** Return HTML strings using `c.html` and Hono's JSX `html` helper.
-   **Auto-Refresh:** Use HTMX polling (`hx-trigger="every 30s"`) to update the dashboard grid without full page reloads.

### 4. Code Structure
```text
src/
├── index.tsx          # Entry point (App & Cron)
├── db.sql             # D1 Schema
├── components/        # JSX UI Components
├── services/
│   ├── logic.ts       # Alert logic (Thresholds/Cooldowns)
│   └── alert.ts       # Slack/Notification integration
└── types.ts           # TS Interfaces
```

## Task Roadmap

### Phase 1: Infrastructure & DB
- [ ] Initialize Hono project on Cloudflare Workers.
- [ ] configure `wrangler.toml` (Cron `* * * * *`, D1 binding).
- [ ] Create `db.sql` with tables: `projects`, `checks`, `logs`.
- [ ] Execute initial D1 migration.

### Phase 2: Core API (The Brain)
- [ ] Implement `PUT /api/config`: Upsert projects and check definitions (auto-registration).
- [ ] Implement `POST /api/pulse`: Handle incoming heartbeats.
- [ ] Implement `services/logic.ts`: Handle state transitions, threshold counting, and cooldown checks.

### Phase 3: The Watcher (Cron)
- [ ] Implement the `scheduled` event handler.
- [ ] Write SQL to find "Dead" checks (`now > last_seen + interval + grace`).
- [ ] Trigger alert logic for discovered dead checks.

### Phase 4: Dashboard (The Face)
- [ ] Create `Layout` and `ProjectCard` components using Hono JSX + Pico.css.
- [ ] Implement HTMX polling for the main grid.
- [ ] Add "Maintenance Mode" toggle buttons (calling API via HTMX).

### Phase 5: Client SDK
- [ ] Create a simple `client_example.py` demonstrating `register()` and `pulse()`.

## Commands
- **Run Local:** `npm run dev`
- **Deploy:** `npx wrangler deploy`
- **DB Migration (Local):** `npx wrangler d1 execute watch-dog-db --local --file=src/db.sql`
- **DB Migration (Prod):** `npx wrangler d1 execute watch-dog-db --file=src/db.sql`

## Critical Rules
1.  **Silence is Failure:** If a project doesn't report, it is assumed dead.
2.  **Idempotency:** The `/api/config` endpoint must be idempotent (upsert).
3.  **Error Handling:** The Cron job must never crash entirely; catch errors for individual checks so processing continues for others.
4.  **Time:** Use Unix Timestamps (seconds) for all DB time fields. Handle Timezones only in the Frontend layer (Alpine.js).
```