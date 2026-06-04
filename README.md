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

## Slack and Teams Bot Webhooks

Bot prompts can be sent to:

```text
POST /api/bots/slack/events
POST /api/bots/teams/messages
```

Set `BOT_WEBHOOK_TOKEN` to require either an `X-Bot-Webhook-Token` header, a `Bearer` token, or a `?token=` query parameter. Bot prompts are persisted as shared chat threads.

## Notifications

The Notifications page manages reusable webhook sinks, routing rules, and delivery history. The first routed incident events are:

- `alert_ingested`
- `rca_completed`
- `rca_failed`
- `incident_status_changed`

## Users and Audit

The Admin page supports local users with `admin`, `operator`, and `viewer` roles. Admin-only APIs manage users/settings, operator APIs manage operational configuration, and viewers retain read/chat access. Privileged changes are written to the audit trail.

Optional OIDC SSO can be enabled with:

```text
OIDC_ISSUER_URL=https://issuer.example.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=https://your-holmes-ui.example.com/api/auth/oidc/callback
OIDC_SCOPES=openid email profile
OIDC_DEFAULT_ROLE=viewer
```

## V1 Boundaries

- Data Sources are read-mostly: the UI verifies and shows setup instructions, but does not mutate Kubernetes or Holmes ConfigMaps.
- Scheduled Prompts run from the Node scheduler and store run history in MongoDB.
- Knowledge entries are injected into Holmes requests through `additional_system_prompt`.
- Authentication is a single-admin cookie session.
