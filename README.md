# Full-stack TiDB demo

This project is a minimal full-stack application demonstrating:

- Node.js backend with authentication (tokens stored in TiDB)
- Frontend simple login page
- TiDB cluster running in Docker Compose
- TiCDC pushing changefeeds to Kafka
- Kafka consumer in Node.js that logs DB changes
- Structured logging via log4js (JSON to console)

How to run (requires Docker & Docker Compose):

1. From the repository root run:

```bash
docker compose up --build
```

2. After services start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

3. Default user: `admin` / `password1`

Notes:
- The TiCDC service creates a changefeed to Kafka topic `tidb_cdc` automatically (see `docker-compose.yml`).
- The `consumer` service subscribes to `tidb_cdc` and logs messages in JSON.
