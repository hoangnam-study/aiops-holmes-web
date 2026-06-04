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

- [x] Status: done
- Priority: P0
- Goal: Trigger Holmes investigations automatically when alerts arrive and store the RCA result on the alert/incident.
- Suggested first slice:
  - Add a background investigation worker.
  - Reuse `HolmesClient.chat` with `request_source: "alert"`.
  - Persist status: queued, investigating, completed, failed.
  - Link generated RCA to alert and incident records.
- Notes:
  - Current code mostly calls Holmes from freeform chat.
  - Implemented automatic RCA queueing from Alertmanager ingestion, Mongo job locking, RCA prompt generation, persisted RCA state/results, and manual retry from the Incidents UI.

## 3. Investigation Timelines and Historical Analysis

- [x] Status: done
- Priority: P0
- Goal: Show replayable incident timelines with alert events, tool calls, evidence, deploy/config changes, comments, and final RCA.
- Suggested first slice:
  - Add `IncidentEvent` model or generalize `ChatEvent`.
  - Persist timeline events during automatic RCA.
  - Add a timeline panel to the incident detail page.
  - Add event filters by type, source, and severity.
- Notes:
  - `ChatEvent` exists today, but it is scoped to chat messages.
  - Implemented `IncidentEvent` timeline storage, event recording for alert ingestion/RCA/status changes, incident detail timeline API, and timeline rendering in the Incidents UI.

## 4. Slack and Microsoft Teams Bot

- [x] Status: done
- Priority: P1
- Goal: Let users tag Holmes in Slack/Teams, ask follow-up questions, and trigger investigations from alert threads.
- Suggested first slice:
  - Add Slack app endpoints for events and interactive actions.
  - Implement "Ask Holmes" action for an alert.
  - Map Slack users/channels to local users/teams.
  - Persist bot-originated conversations as chat threads.
- Notes:
  - Scheduled prompts only support a simple Slack webhook today.
  - Implemented secured Slack and Teams bot webhook endpoints, prompt extraction, Holmes execution, shared chat-thread persistence, and provider-shaped responses.

## 5. Notification Sinks and Alert Routing

- [x] Status: done
- Priority: P1
- Goal: Route enriched alerts and investigation results to Slack, Teams, PagerDuty, Opsgenie, Jira, ServiceNow, and generic webhooks.
- Suggested first slice:
  - Add `NotificationSink` and `RoutingRule` models.
  - Replace scheduled prompt `slackWebhook` special case with a reusable sink service.
  - Add delivery attempts, retry state, and delivery history.
  - Add a routing rules UI.
- Notes:
  - Current scheduled prompt destinations are `none` or `slackWebhook`.
  - Implemented reusable notification sinks, routing rules, delivery logs, notifications UI, and dispatch for alert/RCA/status incident events.

## 6. Multi-User, SSO, RBAC, and Audit Logs

- [x] Status: done
- Priority: P0
- Goal: Replace single-admin auth with team-ready access control and an auditable security model.
- Suggested first slice:
  - Extend `User.role` beyond `admin`.
  - Add `Team`, `Role`, `Permission`, and `AuditLog` models.
  - Add OIDC login support.
  - Scope chats, incidents, sources, and settings by user/team permissions.
- Notes:
  - Current auth is a single-admin cookie session.
  - Implemented admin/operator/viewer roles, admin user management, optional OIDC SSO with PKCE, role-gated routes/sidebar, and audit trail for privileged actions.

## 7. Full Data Source and Toolset Catalog

- [x] Status: done
- Priority: P1
- Goal: Manage the full Holmes toolset/catalog surface, including cloud, observability, databases, ITSM, knowledge bases, Kubernetes, CI/CD, MCP, HTTP, and custom connectors.
- Suggested first slice:
  - Replace static seed list with a catalog schema.
  - Add per-source config schema, secret fields, verification checks, and docs links.
  - Support enabled/disabled/configured/failed status separately.
  - Add exportable Helm/GitOps config snippets.
- Notes:
  - Current data sources are read-mostly and seeded from a small hardcoded list.
  - Implemented richer catalog metadata, expanded built-in sources, data-source create/edit/delete/disable APIs, editable Data Sources UI, and migration defaults for existing records.

## 8. Multi-Cluster and Agent Management

- [x] Status: done
- Priority: P1
- Goal: Register and manage multiple clusters/agents with status, version, health, data source reachability, and scoped investigations.
- Suggested first slice:
  - Add `Cluster` and `Agent` models.
  - Add enrollment token generation.
  - Add heartbeat endpoint for agents.
  - Add cluster picker in chat, alerts, incidents, and data sources.
- Notes:
  - Current settings point to one Holmes API URL.
  - Implemented Cluster/Agent models, encrypted enrollment tokens, public agent heartbeat, cluster/agent APIs, Clusters UI, and audit logs for cluster registration/token rotation.

## 9. Holmes Operator and HealthCheck UI

- [x] Status: done
- Priority: P1
- Goal: Manage Kubernetes-native Holmes `HealthCheck` and `ScheduledHealthCheck` resources from the UI.
- Suggested first slice:
  - Add Health Checks page.
  - Add model for mirrored check status if direct Kubernetes access is not available.
  - Support one-time checks, scheduled checks, reruns, labels, alert mode, and result history.
  - Add deployment verification workflow for CI/CD gates.
- Notes:
  - Current scheduled prompts are Node cron jobs, not Holmes Operator CRDs.
  - Implemented HealthCheck/HealthCheckRun models, Holmes-backed run execution, Health Checks API, audit logging, and Health Checks UI with run history.

## 10. Runbook Catalog and Guided Execution

- [x] Status: done
- Priority: P1
- Goal: Add built-in/custom runbook catalog management with automatic matching, step-by-step execution, evidence capture, and checklist reports.
- Suggested first slice:
  - Add `RunbookCatalog` and `Runbook` models.
  - Support Git-backed or uploaded markdown catalogs.
  - Add runbook matching metadata to investigations.
  - Render per-step status, evidence, skipped steps, and remediation recommendations.
- Notes:
  - Current Knowledge entries are generic prompt injections, not structured runbooks.
  - Implemented Runbook/RunbookExecution models, runbook CRUD API, Holmes-guided execution service, Runbooks UI, execution history, and audit logging.

## 11. Change and Deploy Tracking

- [x] Status: done
- Priority: P0
- Goal: Correlate alerts/incidents with recent deploys, config changes, scaling, rollbacks, and image changes ("what changed before the alert") — Robusta's signature RCA accelerator.
- Suggested first slice:
  - Add a `ChangeEvent` model (kind, cluster, namespace, workload, version, author, source, occurredAt).
  - Add webhook ingestion for ArgoCD/Flux/GitHub/Kubernetes-style change payloads (mirror the Alertmanager webhook).
  - Correlate changes to incidents by labels (cluster/namespace/workload) within a time window.
  - Inject correlated recent changes into the automatic RCA prompt and the incident timeline.
  - Add a Changes page and a "Recent changes" panel on incident detail.
- Notes:
  - Without change context the RCA misses the most common root cause ("a deploy 5 min ago").
  - Implemented `ChangeEvent` model, token-guarded change webhook, manual change API, label+time incident correlation, RCA change-context injection, `change_detected` timeline events, Changes UI, and an incident "Recent changes" panel.
  - Verified live against the connected cluster: alert->incident + correlated change auto-links, timeline `change_detected` event, changes list filter, and the change feeds the RCA prompt.
  - Robustness fix uncovered during live test: the deployed Holmes (behind a gateway) **504s on the blocking `/api/chat`** for long investigations and **500s on empty completions**. Added `HolmesClient.chatToCompletion()` (streaming-to-text, idle-timeout kept alive, tolerant of empty) and switched all background flows (auto-RCA, scheduled prompts, health checks, runbooks, bot, data-source verify) off blocking `chat()`. Auto-RCA now survives multi-minute investigations + retries once on empty. Remaining empty-after-retry is the known `cloud-escalate`/gemini-2.5-flash capability ceiling (accepted), now surfaced as a clear error instead of a cryptic gateway/validation failure.

## 12. Investigation Feedback Loop

- [x] Status: done
- Priority: P1
- Goal: Capture thumbs up/down + notes on RCA results and chat answers to measure and improve investigation quality.
- Suggested first slice:
  - Add a `Feedback` model (targetType, targetId, rating, note, author).
  - Add `POST /api/feedback` and `GET /api/feedback` scoped by target.
  - Add up/down controls to the incident RCA panel (and later chat messages).
  - Surface aggregate score in analytics.
- Notes:
  - Directly addresses the documented `cloud-escalate` model-quality concern by giving a real signal.
  - Implemented generic `Feedback` model, create/list/summary API, and thumbs up/down + note controls on the incident RCA panel.

## 13. Analytics and Reliability Dashboards

- [x] Status: done
- Priority: P1
- Goal: MTTR, alert/incident volume trends, RCA success rate, feedback score, top noisy alerts, and LLM token/cost usage.
- Notes:
  - All raw data already exists (Incident, Alert, ChangeEvent, Feedback) — this is an aggregation + charts layer.
  - Implemented `analyticsService` (Mongo aggregation: MTTR, RCA success rate, feedback score, severity/rca/namespace/alert breakdowns, zero-filled daily timeseries), `GET /api/analytics/overview?days=`, and an Overview landing page with lightweight SVG/MUI visuals (no chart dependency added).
  - Verified live: metrics reflect real data (resolving an incident populated MTTR=1018s, success-rate/feedback/severity/namespace/timeseries all correct).
  - LLM token/cost usage deferred — Holmes does not yet return per-investigation token counts through the proxied response; revisit when available.

## 14. Automation / Playbook Engine (trigger -> action)

- [ ] Status: todo
- Priority: P0
- Goal: Declarative `on_X -> run_Y` engine (e.g. `on_prometheus_alert(critical) -> investigate + notify + restart`) with conditions, enrichers, and chained actions. The defining feature of commercial Robusta.
- Notes: Scheduled prompts (cron) and notification routing (event->sink) are point solutions, not a general engine. Unlocks #15 and bidirectional on-call.

## 15. Remediation / Write-path Actions

- [ ] Status: todo
- Priority: P1
- Goal: One-click / automated remediation (restart pod, rollback deploy, scale, cordon/drain, delete pod) gated by RBAC and the existing tool-approval round-trip.
- Notes: UI is read-only today (README V1 Boundaries). The approval plumbing already exists.

## 16. Efficiency Tooling (KRR right-sizing + misconfig scanning)

- [ ] Status: todo
- Priority: P2
- Goal: Bundle KRR-style CPU/memory right-sizing recommendations and Popeye-style cluster misconfiguration scans.

## 17. Embedded Evidence (metrics graphs / screenshots in investigations)

- [x] Status: done (Prometheus graphs + code blocks)
- Priority: P2
- Goal: Render Prometheus/Grafana charts and visual evidence inline in the RCA, not just tool-call text.
- Notes:
  - Holmes embeds graphs in the answer text as a token `<<{"type":"promql","tool_name":"execute_prometheus_range_query","tool_call_id":"<id>"}>>`; the time-series lives in the matching `tool_calling_result` SSE event (`result.data` is a JSON string holding a Prometheus query_range matrix). Confirmed live against the deployed Holmes.
  - Implemented `holmesGraphs.parsePrometheusGraph()` (parses + downsamples the matrix), graph capture in `streamHolmesTurn` persisted to `assistantMessage.metadata.graphs`, a `PromGraph` SVG multi-series chart, and `MarkdownMessage` token-splitting to render charts in place (no chart dependency added).
  - Code-block parity: added `rehype-highlight` syntax highlighting + a language-label header + copy button (was a plain copy-only block).
  - Verified end-to-end through the chat pipeline: a memory-usage prompt produced a stored graph (1 series, 61 points, real PromQL query) rendered from `metadata.graphs`.
  - Remaining (future): Grafana panel screenshots and graphs in the auto-RCA/incident view (chat-only today).

## 18. Programmatic API + API Tokens

- [ ] Status: todo
- Priority: P2
- Goal: Personal-access / service-account tokens and a documented public API for ingestion and querying.

## 19. PII / Secret Redaction and Data Governance

- [ ] Status: todo
- Priority: P2
- Goal: Redact secrets/PII before data reaches the LLM; an enterprise compliance blocker.

## 20. Bidirectional On-call (ack / resolve / silence)

- [ ] Status: todo
- Priority: P2
- Goal: Sync ack/resolve/silence with PagerDuty/Opsgenie and support alert silencing/snooze (today sinks are send-only).

## 21. Alert Noise Reduction / Correlation Grouping

- [ ] Status: todo
- Priority: P2
- Goal: Correlation-based grouping of related alerts into a single incident beyond label dedupe.

## 22. Post-mortem Generation and Sharing

- [ ] Status: todo
- Priority: P2
- Goal: Auto-generate post-mortem docs, shareable public links, and PDF export.

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
