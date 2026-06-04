import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TerminalIcon from "@mui/icons-material/Terminal";
import type { ChatEvent } from "../types/api";

const visibleEvents = new Set([
  "start_tool_calling",
  "tool_calling_result",
  "token_count",
  "conversation_history_compaction_start",
  "conversation_history_compacted"
]);

export default function ToolTimeline({ events }: { events: ChatEvent[] }) {
  const filtered = events.filter((event) => visibleEvents.has(event.eventType));
  if (!filtered.length) return null;

  return (
    <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TerminalIcon fontSize="small" />
          <Typography variant="body2" fontWeight={700}>
            Analysis
          </Typography>
          <Chip size="small" label={`${filtered.length} events`} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack spacing={1}>
          {filtered.map((event) => (
            <Box key={event._id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {event.eventType}
              </Typography>
              <Typography
                component="pre"
                variant="caption"
                sx={{ whiteSpace: "pre-wrap", m: 0, mt: 0.5, color: "text.secondary" }}
              >
                {JSON.stringify(event.payload, null, 2)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
