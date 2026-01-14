# Full-stack TiDB demo

This project is a minimal full-stack application demonstrating:

- Node.js backend with authentication (tokens stored in TiDB)
- Frontend single-page login/signup UI (React UMD)
- TiDB cluster running in Docker Compose
- TiCDC pushing changefeeds to Kafka
- Kafka consumer in Node.js that logs DB changes
- Structured logging via log4js (JSON file outputs + action audit log)

## Prerequisites

- Docker Desktop (or Docker Engine) with Docker Compose plugin
- At least 4 CPU / 8 GB RAM allocated to Docker (TiDB needs resources)

## How to run

1. From the repository root run:

```bash
docker compose up --build
```

2. Wait until all services finish starting (PD/TiKV/TiDB, Kafka, backend, frontend).

3. Services:
	 - Frontend UI: http://localhost:3000
	 - Backend API: http://localhost:3001
	 - TiDB SQL port: localhost:4000 (MySQL protocol)

4. Default credentials: `admin` / `password1`
The backend (`backend` and `db-init` services) waits for TiDB to accept connections before starting to avoid race conditions. Logs are written to `backend/logs/json.log` and `backend/logs/actions.log` inside the container.

## API reference

All endpoints are served from `http://localhost:3001`. Requests and responses use JSON.

### POST /login

Authenticate an existing user.

```bash
curl -X POST http://localhost:3001/login \
	-H 'Content-Type: application/json' \
	-d '{"username":"admin","password":"password1"}'
```

Response:

```json
{ "token": "<uuid-token>" }
```

### POST /signup

Create a new user (password must be ≥8 chars, include letters and numbers).

```bash
curl -X POST http://localhost:3001/signup \
	-H 'Content-Type: application/json' \
	-d '{"username":"alice","email":"alice@example.com","password":"p4ssword1"}'
```

Response structure is identical to `/login`.

### GET /profile

Retrieve the logged-in user’s profile using the token from `/login` or `/signup`.

```bash
curl http://localhost:3001/profile \
	-H 'x-auth-token: <uuid-token>'
```

### GET /admin/users

List all users (admin-only endpoint).

```bash
curl http://localhost:3001/admin/users \
	-H 'x-auth-token: <admin-token>'
```

Returns:

```json
{ "users": [ { "id": 1, "username": "admin", "email": "admin@example.com", "created_at": "..." }, ... ] }
```

Tokens never expire in this demo; protection is based solely on possession of the token and the username equalling `admin` for admin-only routes.

## Kafka & TiCDC

Notes:
- The TiCDC service creates a changefeed to Kafka topic `tidb_cdc` automatically (see `docker-compose.yml`).
- The `consumer` service subscribes to `tidb_cdc` and logs messages in JSON.
- For a quick Kafka connectivity smoke test you can run `node backend/scripts/kafka-smoke.js` (inside the backend container or with dependencies installed locally).
