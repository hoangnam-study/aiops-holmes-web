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

## Inline Graphs and Code Blocks

Chat answers render the same rich content as the commercial UI:

- **Prometheus graphs** — Holmes embeds graph tokens (`<<{"type":"promql",...}>>`) in its answer; the backend parses the matching `tool_calling_result` time-series, persists it on the message, and the chat renders an inline multi-series line chart (no external chart library).
- **Code blocks** — syntax-highlighted (`rehype-highlight`) with a language-label header and copy button.

## Overview Analytics

The Overview page (default landing page) shows reliability analytics over a selectable window:

```text
GET /api/analytics/overview?days=30
```

Metrics: incident volume, open count, MTTR, RCA success rate, investigation feedback score, alert/change totals, a daily incidents-vs-alerts timeseries, and breakdowns by severity, RCA status, top namespaces, and noisiest alerts. All values are aggregated from existing data (incidents, alerts, changes, feedback); no external analytics store is required.

## Change and Deploy Tracking

Deploy, config, scale, rollback, and image-change events can be posted to:

```text
POST /api/changes/webhooks/event
```

The payload is flexible — single object, `{ "changes": [...] }`, or a raw array — and field names from ArgoCD, Flux, GitHub deploys, or Kubernetes events are normalized (e.g. `revision`/`image`/`tag` → version, `app`/`deployment` → workload). Set `CHANGE_INGEST_TOKEN` to require an `X-Change-Ingest-Token` header, a `Bearer` token, or a `?token=` query parameter.

Recorded changes are correlated to active incidents by labels (cluster/namespace/workload) within a 6-hour lookback before the incident fired, surfaced on the incident timeline and a "Recent changes" panel, and injected into the automatic RCA prompt as likely root causes. The Changes page lists all changes and supports recording one manually.

## Investigation Feedback

RCA results accept thumbs up/down feedback (one rating per user, re-submittable) via:

```text
POST /api/feedback        { targetType, targetId, rating, note? }
GET  /api/feedback?targetType=incident_rca&targetId=<id>
```

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
