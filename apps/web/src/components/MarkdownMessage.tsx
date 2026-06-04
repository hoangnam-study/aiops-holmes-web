import type { ReactNode } from "react";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import PromGraph from "./PromGraph";
import type { GraphData } from "../types/api";

// Holmes embeds graphs as a token in the answer text:
//   <<{"type": "promql", "tool_name": "...", "tool_call_id": "<id>"}>>
const GRAPH_TOKEN_RE = /<<(\{[^<>]*?\})>>/g;

type Segment = { kind: "text"; value: string } | { kind: "graph"; toolCallId: string };

/** Split answer text into markdown segments and embedded-graph placeholders. */
function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(GRAPH_TOKEN_RE)) {
    const index = match.index ?? 0;
    const json = match[1];
    let toolCallId = "";
    try {
      const parsed = JSON.parse(json ?? "") as { type?: string; tool_call_id?: string };
      if (parsed.type === "promql" && parsed.tool_call_id) toolCallId = parsed.tool_call_id;
    } catch {
      // not a graph token — leave it as text
    }
    if (!toolCallId) continue;
    if (index > lastIndex) segments.push({ kind: "text", value: content.slice(lastIndex, index) });
    segments.push({ kind: "graph", toolCallId });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) segments.push({ kind: "text", value: content.slice(lastIndex) });
  return segments.length ? segments : [{ kind: "text", value: content }];
}

function languageOf(node: ReactNode): string | undefined {
  const child = Array.isArray(node) ? node[0] : node;
  const className =
    child && typeof child === "object" && "props" in child
      ? ((child as { props?: { className?: string } }).props?.className ?? "")
      : "";
  const match = /language-([a-z0-9+#-]+)/i.exec(className);
  return match?.[1];
}

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        pre({ children }) {
          const language = languageOf(children);
          const text = String(children).replace(/\[object Object\]/g, "");
          return (
            <Box sx={{ my: 1.25, borderRadius: 1, overflow: "hidden", border: "1px solid #1f2733" }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ bgcolor: "#1b222d", px: 1.5, py: 0.5 }}
              >
                <Typography variant="caption" sx={{ color: "#9fb0c3", fontWeight: 700, letterSpacing: 0.3 }}>
                  {language ?? "text"}
                </Typography>
                <Tooltip title="Copy">
                  <IconButton size="small" onClick={() => void navigator.clipboard.writeText(text)} sx={{ color: "#9fb0c3" }}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: "#242c3b", overflowX: "auto", fontSize: 13 }}>
                {children}
              </Box>
            </Box>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function MarkdownMessage({ content, graphs }: { content: string; graphs?: Record<string, GraphData> }) {
  const segments = splitSegments(content);
  return (
    <Box
      sx={{
        fontSize: 14.5,
        lineHeight: 1.7,
        "& p": { my: 1 },
        "& ul, & ol": { pl: 3 },
        "& code": { bgcolor: "#eef2f6", borderRadius: 0.75, px: 0.5, py: 0.1 },
        "& pre code": { bgcolor: "transparent", p: 0 },
        "& table": { borderCollapse: "collapse", width: "100%", my: 1.5 },
        "& th, & td": { border: "1px solid #dfe5eb", p: 1, textAlign: "left" }
      }}
    >
      {segments.map((segment, index) => {
        if (segment.kind === "graph") {
          const graph = graphs?.[segment.toolCallId];
          if (graph) return <PromGraph key={`g-${index}`} graph={graph} />;
          return (
            <Chip
              key={`g-${index}`}
              size="small"
              icon={<ShowChartIcon />}
              label="Graph unavailable"
              variant="outlined"
              sx={{ my: 1 }}
            />
          );
        }
        return <Markdown key={`t-${index}`} content={segment.value} />;
      })}
    </Box>
  );
}
