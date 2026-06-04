import { useMemo } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import dayjs from "dayjs";
import type { GraphData } from "../types/api";

const SERIES_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#f59e0b",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#4f46e5",
  "#ea580c",
  "#0d9488",
  "#7c3aed"
];

const W = 760;
const H = 240;
const PAD = { top: 12, right: 16, bottom: 26, left: 56 };

/** Compact value formatter: detects byte-scale magnitudes, else SI-ish suffixes. */
function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)}Gi`;
  if (abs >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}Mi`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs > 0 && abs < 1) return value.toFixed(3);
  return String(Math.round(value * 100) / 100);
}

export default function PromGraph({ graph }: { graph: GraphData }) {
  const model = useMemo(() => {
    const allPoints = graph.series.flatMap((s) => s.points);
    if (!allPoints.length) return null;
    const minT = Math.min(...allPoints.map((p) => p.t));
    const maxT = Math.max(...allPoints.map((p) => p.t));
    const maxV = Math.max(...allPoints.map((p) => p.v));
    const minV = Math.min(0, ...allPoints.map((p) => p.v));
    const spanT = maxT - minT || 1;
    const spanV = maxV - minV || 1;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - minT) / spanT) * plotW;
    const y = (v: number) => PAD.top + plotH - ((v - minV) / spanV) * plotH;

    const lines = graph.series.map((s, index) => ({
      name: s.name,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      d: s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ")
    }));
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const v = minV + f * spanV;
      return { v, y: y(v) };
    });
    return { minT, maxT, lines, yTicks };
  }, [graph]);

  if (!model) {
    return (
      <Box sx={{ my: 1.5, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">No data points for this graph.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ my: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "#fff" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <ShowChartIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, minWidth: 0 }} noWrap>
          {graph.description || "Prometheus graph"}
        </Typography>
        <Chip size="small" label="PromQL" variant="outlined" />
      </Stack>
      {graph.query ? (
        <Typography
          variant="caption"
          component="div"
          sx={{ fontFamily: "monospace", color: "text.secondary", mb: 1, overflowX: "auto", whiteSpace: "pre" }}
        >
          {graph.query}
        </Typography>
      ) : null}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={graph.description || "Prometheus graph"}>
        {model.yTicks.map((tick, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={tick.y} x2={W - PAD.right} y2={tick.y} stroke="#eef2f7" strokeWidth={1} />
            <text x={PAD.left - 6} y={tick.y + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
              {formatValue(tick.v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 8} textAnchor="start" fontSize={10} fill="#94a3b8">
          {dayjs.unix(model.minT).format("HH:mm")}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize={10} fill="#94a3b8">
          {dayjs.unix(model.maxT).format("HH:mm")}
        </text>
        {model.lines.map((line) => (
          <path key={line.name} d={line.d} fill="none" stroke={line.color} strokeWidth={1.5} />
        ))}
      </svg>
      {graph.series.length > 1 ? (
        <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
          {model.lines.map((line) => (
            <Stack key={line.name} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: line.color }} />
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200 }} noWrap>
                {line.name}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
