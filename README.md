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
git clone https://github.com/paipeter0801/watch-dog.git
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

## Documentation

- [Usage Guide](docs/usage.md) - User documentation and client integration
- [API Documentation](docs/api.md) - Complete API reference
- [Development Guide](docs/development.md) - Setup and development instructions
- [Testing Checklist](docs/testing.md) - Manual testing procedures

## License

MIT
