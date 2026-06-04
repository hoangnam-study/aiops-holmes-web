# HolmesGPT Commercial Gap TODO

Track the feature gaps between this self-hosted HolmesGPT UI and the commercial Robusta/HolmesGPT platform. Move one item at a time from `todo` to `in progress` to `done`, and add implementation notes under each item as we build.

Status legend: `[ ] todo`, `[~] in progress`, `[x] done`.

## 1. Alert and Incident Inbox

- [x] Status: done
- Priority: P0
- Goal: Add a first-class inbox for alerts and incidents with grouping, dedupe, ownership, severity, lifecycle status, and filters.
- Suggested first slice:
  - Add `Alert` and `Incident` Mongo models.
  - Add webhook ingestion for Alertmanager-compatible payloads.
  - Add `/api/alerts` and `/api/incidents` routes.
  - Add an Alerts/Incidents page in the sidebar.
- Notes:
  - Commercial Robusta centers the UI around alert triage and grouping.
  - Implemented Alert/Incident models, authenticated list/detail/update APIs, Alertmanager webhook ingestion, Incidents UI, and status/severity filtering.

## 2. Automatic RCA for Every Alert

- [ ] Status: todo
- Priority: P0
- Goal: Trigger Holmes investigations automatically when alerts arrive and store the RCA result on the alert/incident.
- Suggested first slice:
  - Add a background investigation worker.
  - Reuse `HolmesClient.chat` with `request_source: "alert"`.
  - Persist status: queued, investigating, completed, failed.
  - Link generated RCA to alert and incident records.
- Notes:
  - Current code mostly calls Holmes from freeform chat.

## 3. Investigation Timelines and Historical Analysis

- [ ] Status: todo
- Priority: P0
- Goal: Show replayable incident timelines with alert events, tool calls, evidence, deploy/config changes, comments, and final RCA.
- Suggested first slice:
  - Add `IncidentEvent` model or generalize `ChatEvent`.
  - Persist timeline events during automatic RCA.
  - Add a timeline panel to the incident detail page.
  - Add event filters by type, source, and severity.
- Notes:
  - `ChatEvent` exists today, but it is scoped to chat messages.

## 4. Slack and Microsoft Teams Bot

- [ ] Status: todo
- Priority: P1
- Goal: Let users tag Holmes in Slack/Teams, ask follow-up questions, and trigger investigations from alert threads.
- Suggested first slice:
  - Add Slack app endpoints for events and interactive actions.
  - Implement "Ask Holmes" action for an alert.
  - Map Slack users/channels to local users/teams.
  - Persist bot-originated conversations as chat threads.
- Notes:
  - Scheduled prompts only support a simple Slack webhook today.

## 5. Notification Sinks and Alert Routing

- [ ] Status: todo
- Priority: P1
- Goal: Route enriched alerts and investigation results to Slack, Teams, PagerDuty, Opsgenie, Jira, ServiceNow, and generic webhooks.
- Suggested first slice:
  - Add `NotificationSink` and `RoutingRule` models.
  - Replace scheduled prompt `slackWebhook` special case with a reusable sink service.
  - Add delivery attempts, retry state, and delivery history.
  - Add a routing rules UI.
- Notes:
  - Current scheduled prompt destinations are `none` or `slackWebhook`.

## 6. Multi-User, SSO, RBAC, and Audit Logs

- [ ] Status: todo
- Priority: P0
- Goal: Replace single-admin auth with team-ready access control and an auditable security model.
- Suggested first slice:
  - Extend `User.role` beyond `admin`.
  - Add `Team`, `Role`, `Permission`, and `AuditLog` models.
  - Add OIDC login support.
  - Scope chats, incidents, sources, and settings by user/team permissions.
- Notes:
  - Current auth is a single-admin cookie session.

## 7. Full Data Source and Toolset Catalog

- [ ] Status: todo
- Priority: P1
- Goal: Manage the full Holmes toolset/catalog surface, including cloud, observability, databases, ITSM, knowledge bases, Kubernetes, CI/CD, MCP, HTTP, and custom connectors.
- Suggested first slice:
  - Replace static seed list with a catalog schema.
  - Add per-source config schema, secret fields, verification checks, and docs links.
  - Support enabled/disabled/configured/failed status separately.
  - Add exportable Helm/GitOps config snippets.
- Notes:
  - Current data sources are read-mostly and seeded from a small hardcoded list.

## 8. Multi-Cluster and Agent Management

- [ ] Status: todo
- Priority: P1
- Goal: Register and manage multiple clusters/agents with status, version, health, data source reachability, and scoped investigations.
- Suggested first slice:
  - Add `Cluster` and `Agent` models.
  - Add enrollment token generation.
  - Add heartbeat endpoint for agents.
  - Add cluster picker in chat, alerts, incidents, and data sources.
- Notes:
  - Current settings point to one Holmes API URL.

## 9. Holmes Operator and HealthCheck UI

- [ ] Status: todo
- Priority: P1
- Goal: Manage Kubernetes-native Holmes `HealthCheck` and `ScheduledHealthCheck` resources from the UI.
- Suggested first slice:
  - Add Health Checks page.
  - Add model for mirrored check status if direct Kubernetes access is not available.
  - Support one-time checks, scheduled checks, reruns, labels, alert mode, and result history.
  - Add deployment verification workflow for CI/CD gates.
- Notes:
  - Current scheduled prompts are Node cron jobs, not Holmes Operator CRDs.

## 10. Runbook Catalog and Guided Execution

- [ ] Status: todo
- Priority: P1
- Goal: Add built-in/custom runbook catalog management with automatic matching, step-by-step execution, evidence capture, and checklist reports.
- Suggested first slice:
  - Add `RunbookCatalog` and `Runbook` models.
  - Support Git-backed or uploaded markdown catalogs.
  - Add runbook matching metadata to investigations.
  - Render per-step status, evidence, skipped steps, and remediation recommendations.
- Notes:
  - Current Knowledge entries are generic prompt injections, not structured runbooks.

## Working Order

Recommended sequence:

1. Alert and Incident Inbox
2. Automatic RCA for Every Alert
3. Investigation Timelines and Historical Analysis
4. Multi-User, SSO, RBAC, and Audit Logs
5. Notification Sinks and Alert Routing
6. Slack and Microsoft Teams Bot
7. Multi-Cluster and Agent Management
8. Full Data Source and Toolset Catalog
9. Holmes Operator and HealthCheck UI
10. Runbook Catalog and Guided Execution
