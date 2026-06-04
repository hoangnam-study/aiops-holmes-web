import { useState } from "react";
import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import PageHeader from "../components/PageHeader";
import { apiFetch } from "../api/client";
import type { AnalyticsOverview } from "../types/api";

const ranges = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 14 days", value: 14 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 }
];

const severityColors: Record<string, string> = {
  critical: "#dc2626",
  warning: "#f59e0b",
  info: "#2563eb",
  unknown: "#94a3b8"
};

const rcaColors: Record<string, string> = {
  completed: "#16a34a",
  failed: "#dc2626",
  investigating: "#f59e0b",
  queued: "#2563eb",
  not_started: "#94a3b8"
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatPct(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}

function StatCard({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", flex: "1 1 150px", minWidth: 150 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 0.5, color: color ?? "text.primary" }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Paper>
  );
}

function HBars({ items, fallbackColor, colorMap }: { items: Array<{ key: string; count: number }>; fallbackColor: string; colorMap?: Record<string, string> }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (!items.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No data in this range.
      </Typography>
    );
  }
  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Box key={item.key}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: "80%" }}>
              {item.key}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {item.count}
            </Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#eef2f7", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${(item.count / max) * 100}%`,
                bgcolor: colorMap?.[item.key] ?? fallbackColor,
                borderRadius: 4
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function TimeseriesChart({ data }: { data: AnalyticsOverview["timeseries"] }) {
  const height = 160;
  const max = Math.max(1, ...data.map((d) => Math.max(d.incidents, d.alerts)));
  const slot = 10;
  const width = Math.max(data.length * slot, slot);
  const barW = 3.4;
  const scale = (value: number) => (value / max) * (height - 8);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "#2563eb" }} />
          <Typography variant="caption" color="text.secondary">Incidents</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "#f59e0b" }} />
          <Typography variant="caption" color="text.secondary">Alerts</Typography>
        </Stack>
      </Stack>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Incidents and alerts over time">
        {data.map((d, index) => {
          const x = index * slot;
          const incH = scale(d.incidents);
          const alertH = scale(d.alerts);
          return (
            <g key={d.date}>
              <rect x={x + 1.2} y={height - incH} width={barW} height={incH} fill="#2563eb" rx={0.8} />
              <rect x={x + 1.2 + barW + 0.6} y={height - alertH} width={barW} height={alertH} fill="#f59e0b" rx={0.8} />
            </g>
          );
        })}
      </svg>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{data[0] ? dayjs(data[0].date).format("MMM D") : ""}</Typography>
        <Typography variant="caption" color="text.secondary">{data.length ? dayjs(data[data.length - 1]?.date).format("MMM D") : ""}</Typography>
      </Stack>
    </Box>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", flex: "1 1 320px", minWidth: 300 }}>
      <Typography variant="h6">{title}</Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {subtitle}
        </Typography>
      ) : (
        <Box sx={{ mb: 1.5 }} />
      )}
      {children}
    </Paper>
  );
}

export default function OverviewPage() {
  const [days, setDays] = useState(30);
  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", days],
    queryFn: () => apiFetch<AnalyticsOverview>(`/api/analytics/overview?days=${days}`),
    refetchInterval: 60_000
  });

  const data = overviewQuery.data;
  const s = data?.summary;

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Overview"
        subtitle="Incident volume, MTTR, RCA success, and investigation feedback."
        actions={
          <TextField size="small" select label="Range" value={days} onChange={(event) => setDays(Number(event.target.value))} sx={{ minWidth: 170 }}>
            {ranges.map((range) => (
              <MenuItem key={range.value} value={range.value}>{range.label}</MenuItem>
            ))}
          </TextField>
        }
      />

      <Box sx={{ p: 3, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {overviewQuery.isLoading || !data || !s ? (
          <Box sx={{ p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              <StatCard label="Incidents" value={String(s.incidentsTotal)} hint={`${s.incidentsOpen} open now`} />
              <StatCard label="MTTR" value={formatDuration(s.mttrSeconds)} hint={`${s.resolvedCount} resolved`} />
              <StatCard
                label="RCA success"
                value={formatPct(s.rcaSuccessRate)}
                hint={`${s.rcaCompleted} ok · ${s.rcaFailed} failed`}
                color={s.rcaSuccessRate !== null && s.rcaSuccessRate < 0.5 ? "#dc2626" : "#16a34a"}
              />
              <StatCard
                label="Feedback score"
                value={formatPct(s.feedbackScore)}
                hint={`${s.feedbackUp} 👍 · ${s.feedbackDown} 👎`}
              />
              <StatCard label="Alerts" value={String(s.alertsTotal)} />
              <StatCard label="Changes" value={String(s.changesTotal)} />
            </Stack>

            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Volume over time
              </Typography>
              <TimeseriesChart data={data.timeseries} />
            </Paper>

            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              <SectionCard title="Incidents by severity">
                <HBars items={data.severity} fallbackColor="#2563eb" colorMap={severityColors} />
              </SectionCard>
              <SectionCard title="RCA status">
                <HBars items={data.rcaStatus} fallbackColor="#2563eb" colorMap={rcaColors} />
              </SectionCard>
            </Stack>

            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              <SectionCard title="Top namespaces" subtitle="Namespaces with the most incidents.">
                <HBars items={data.topNamespaces} fallbackColor="#7c3aed" />
              </SectionCard>
              <SectionCard title="Noisiest alerts" subtitle="Alert names by volume.">
                <HBars items={data.topAlerts} fallbackColor="#f59e0b" />
              </SectionCard>
            </Stack>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
