# Event-Driven Notification Broker

> Migrating from synchronous, blocking API architecture to asynchronous Event-Driven Architecture (EDA) using RabbitMQ, Feature Flags, and long-running Git branch management.

## Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────┐         ┌───────────────────────┐
│   Client (curl)     │  POST   │  Express API Server  │ publish │     RabbitMQ Broker    │
│                     │ ──────> │  (src/server.js)     │ ──────> │ Exchange: user.events  │
│                     │ <────── │  Feature Flag Toggle  │         │ Queue: email_service   │
│   201 Created (~5ms)│         │                      │         │                       │
└─────────────────────┘         └──────────────────────┘         └───────────┬───────────┘
                                                                            │ consume
                                                                 ┌──────────▼───────────┐
                                                                 │  Background Worker   │
                                                                 │  (src/worker.js)     │
                                                                 │  Sends mock email    │
                                                                 │  (~2000ms async)     │
                                                                 └──────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start RabbitMQ broker
docker compose up -d

# 3. Start the API server (Terminal 1)
npm start

# 4. Start the background worker (Terminal 2)
npm run worker

# 5. Run the interactive demo (Terminal 3)
npm run demo
```

## API Endpoints

| Method | Endpoint         | Description                                      |
|--------|------------------|--------------------------------------------------|
| GET    | `/health`        | Health check with current feature flag state      |
| GET    | `/users`         | List all registered users                         |
| POST   | `/users`         | Register user (sync or async based on flag)       |
| GET    | `/config/flags`  | Inspect current feature flags                     |
| POST   | `/config/flags`  | Toggle a feature flag at runtime                  |

## Feature Flags

The `ENABLE_ASYNC_NOTIFICATIONS` flag controls which code path executes:

- **`false` (default):** Synchronous. API blocks ~2s simulating SMTP email before responding.
- **`true`:** Asynchronous. API publishes `UserSignedUp` event to RabbitMQ and responds in <50ms.

Toggle at runtime:
```bash
curl -X POST http://localhost:4000/config/flags \
  -H "Content-Type: application/json" \
  -d '{"flag": "ENABLE_ASYNC_NOTIFICATIONS", "enabled": true}'
```

## Scripts

| Script              | Command              | Purpose                                                |
|---------------------|----------------------|--------------------------------------------------------|
| API Server          | `npm start`          | Express API with feature-toggled notification dispatch  |
| Background Worker   | `npm run worker`     | RabbitMQ consumer that processes queued email events    |
| Interactive Demo    | `npm run demo`       | Runs both sync and async flows end-to-end              |
| Performance Bench   | `npm run benchmark`  | Compares latency between sync and async modes          |

## Git Strategy Practiced

This project demonstrates managing a long-running feature branch alongside an active `main` branch:

1. **Phase 1:** Baseline synchronous API committed to `main`
2. **Phase 2:** `feature/rabbitmq-migration` branch created; feature flag added
3. **Phase 3:** Publisher logic committed on feature branch
4. **Phase 4:** Simulated coworker commit on `main` → merge conflict triggered and resolved
5. **Phase 5:** Worker subscriber committed; full async flow validated
6. **Phase 6:** Clean merge of feature branch back into `main`

## License

MIT
