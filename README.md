# HolmesGPT Web UI

Self-hosted HolmesGPT web UI for the `aiops-stack` deployment.

## Stack

- Frontend: React, TypeScript, MUI, Vite
- Backend: Node.js, Express, TypeScript
- Database: MongoDB
- Holmes integration: backend-only proxy to Holmes `/api/chat`

## Local Development

```bash
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173` and proxies `/api` to the Express API at `http://localhost:8080`.

Default admin:

```text
admin@example.com
holmes-admin
```

The API talks to your deployed Holmes Route by default:

```text
HOLMES_API_URL=https://holmes.observestack.fis-cloud.xplat.online
HOLMES_API_VERIFY_SSL=false
```

`HOLMES_API_VERIFY_SSL=false` is needed for the current OpenShift Route certificate chain.

## Docker Compose

```bash
docker compose up --build
```

Open `http://localhost:3000`. Compose defaults to:

```text
HOLMES_API_URL=https://holmes.observestack.fis-cloud.xplat.online
HOLMES_API_VERIFY_SSL=false
```

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

## Alert Ingestion

Alertmanager-compatible webhooks can post to:

```text
POST /api/alerts/webhooks/alertmanager
```

Set `ALERT_INGEST_TOKEN` to require either an `X-Alert-Ingest-Token` header, a `Bearer` token, or a `?token=` query parameter.

## V1 Boundaries

- Data Sources are read-mostly: the UI verifies and shows setup instructions, but does not mutate Kubernetes or Holmes ConfigMaps.
- Scheduled Prompts run from the Node scheduler and store run history in MongoDB.
- Knowledge entries are injected into Holmes requests through `additional_system_prompt`.
- Authentication is a single-admin cookie session.
