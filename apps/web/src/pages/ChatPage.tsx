import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { apiFetch, deleteJson, postJson } from "../api/client";
import { extractStreamedText, STREAM_TEXT_EVENTS, streamPost } from "../api/stream";
import MarkdownMessage from "../components/MarkdownMessage";
import ToolTimeline from "../components/ToolTimeline";
import type { ChatEvent, ChatMessage, ChatThread, GraphData, Settings, StreamEvent } from "../types/api";

const promptCards = [
  {
    title: "Outage Prevention",
    text: "Which service is the most likely to cause an outage in my cluster?"
  },
  {
    title: "Surprise Me",
    text: "What's the strongest signal happening in my cluster right now?"
  },
  {
    title: "Exposed Secrets",
    text: "Are any of my workloads leaking secrets or risky environment values?"
  }
];

const EMPTY_HOLMES_RESPONSE =
  "Holmes returned an empty response from the selected model. Retry the prompt; if it repeats, check Holmes/LiteLLM logs for completion_tokens: 0.";

interface ThreadDetail {
  thread: ChatThread;
  messages: ChatMessage[];
  events: ChatEvent[];
}

interface PendingApproval {
  tool_call_id: string;
  tool_name?: string;
  description?: string;
  params?: Record<string, unknown>;
}

function pendingApprovalsOf(message: ChatMessage): PendingApproval[] {
  const pending = (message.metadata as { pending_approvals?: unknown } | undefined)?.pending_approvals;
  return Array.isArray(pending) ? (pending as PendingApproval[]) : [];
}

export default function ChatPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [ask, setAsk] = useState("");
  const [model, setModel] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [localEvents, setLocalEvents] = useState<ChatEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [requireApproval, setRequireApproval] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<{ settings: Settings }>("/api/settings")
  });

  const modelsQuery = useQuery({
    queryKey: ["holmes-models"],
    queryFn: () => apiFetch<{ models: string[]; defaultModel: string }>("/api/holmes/models")
  });

  const threadsQuery = useQuery({
    queryKey: ["chats", search],
    queryFn: () => apiFetch<{ threads: ChatThread[] }>(`/api/chats${search ? `?search=${encodeURIComponent(search)}` : ""}`)
  });

  const detailQuery = useQuery({
    queryKey: ["chat", threadId],
    queryFn: () => apiFetch<ThreadDetail>(`/api/chats/${threadId}`),
    enabled: Boolean(threadId)
  });

  useEffect(() => {
    setModel(detailQuery.data?.thread.model || settingsQuery.data?.settings.defaultModel || "cloud-escalate");
  }, [detailQuery.data?.thread.model, settingsQuery.data?.settings.defaultModel]);

  useEffect(() => {
    if (streaming) return;
    setLocalMessages(detailQuery.data?.messages ?? []);
    setLocalEvents(detailQuery.data?.events ?? []);
  }, [detailQuery.data, streaming]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [localMessages, localEvents]);

  const createThread = useMutation({
    mutationFn: () => postJson<{ thread: ChatThread }>("/api/chats", { model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }
  });

  const deleteThread = useMutation({
    mutationFn: (id: string) => deleteJson<{ ok: boolean }>(`/api/chats/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate("/chat");
    }
  });

  const saveKnowledge = useMutation({
    mutationFn: (message: ChatMessage) =>
      postJson("/api/knowledge", {
        title: message.content.split("\n").find(Boolean)?.slice(0, 80) || "Saved Holmes skill",
        content: message.content,
        scope: "global",
        type: "skill",
        enabled: true,
        tags: ["chat"]
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] })
  });

  const modelOptions = useMemo(() => {
    const options = new Set<string>();
    if (model) options.add(model);
    if (settingsQuery.data?.settings.defaultModel) options.add(settingsQuery.data.settings.defaultModel);
    for (const name of modelsQuery.data?.models ?? []) options.add(name);
    if (options.size === 0) options.add("cloud-escalate");
    return [...options];
  }, [model, modelsQuery.data?.models, settingsQuery.data?.settings.defaultModel]);

  const selectedEventsByMessage = useMemo(() => {
    const grouped = new Map<string, ChatEvent[]>();
    for (const event of localEvents) {
      const key = event.messageId ?? "latest";
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return grouped;
  }, [localEvents]);

  async function ensureThread() {
    if (threadId) return threadId;
    const payload = await createThread.mutateAsync();
    navigate(`/chat/${payload.thread._id}`);
    return payload.thread._id;
  }

  function patchAssistant(patch: Partial<ChatMessage>) {
    setLocalMessages((current) => {
      const copy = [...current];
      const lastIndex = copy.map((message) => message.role).lastIndexOf("assistant");
      const existing = copy[lastIndex];
      if (lastIndex >= 0 && existing) copy[lastIndex] = { ...existing, ...patch };
      return copy;
    });
  }

  function updateAssistant(content: string, status: ChatMessage["status"] = "streaming") {
    patchAssistant({ content, status });
  }

  interface StreamRefs {
    accumulated: { current: string };
    currentAssistantId: { current: string };
    activeThreadId: string;
    signal: AbortSignal;
    tempUserId?: string;
    tempAssistantId?: string;
  }

  // Single SSE consumer shared by the message-send and tool-approval-continue
  // flows so both render streamed tokens, tool events, approvals and errors
  // identically.
  const consumeStream = async (path: string, body: Record<string, unknown>, refs: StreamRefs) => {
    await streamPost(
      path,
      body,
      (event: StreamEvent) => {
        if (event.event === "chat_metadata") {
          const assistantMessageId = String(event.data.assistantMessageId ?? refs.tempAssistantId ?? "");
          if (assistantMessageId) refs.currentAssistantId.current = assistantMessageId;
          setLocalMessages((current) =>
            current.map((message) => {
              if (refs.tempUserId && message._id === refs.tempUserId)
                return { ...message, _id: String(event.data.userMessageId ?? refs.tempUserId) };
              if (refs.tempAssistantId && message._id === refs.tempAssistantId && assistantMessageId)
                return { ...message, _id: assistantMessageId };
              return message;
            })
          );
          return;
        }

        const textChunk = extractStreamedText(event);
        if (textChunk) {
          refs.accumulated.current += textChunk;
          updateAssistant(refs.accumulated.current);
        }
        if (event.event === "ai_answer_end") {
          const answer = String(event.data.analysis ?? event.data.content ?? refs.accumulated.current);
          updateAssistant(answer.trim() ? answer : EMPTY_HOLMES_RESPONSE, answer.trim() ? "completed" : "error");
        }
        if (event.event === "approval_required") {
          patchAssistant({
            content: String(event.data.analysis ?? event.data.content ?? refs.accumulated.current),
            status: "awaiting_approval",
            metadata: { pending_approvals: event.data.pending_approvals ?? [] }
          });
        }
        if (event.event === "error") {
          const message = String(event.data.msg ?? event.data.description ?? "Holmes returned an error");
          setStreamError(message);
          updateAssistant(message, "error");
        }
        if (event.event !== "chat_metadata" && !STREAM_TEXT_EVENTS.has(event.event)) {
          setLocalEvents((current) => [
            ...current,
            {
              _id: `tmp-event-${Date.now()}-${current.length}`,
              threadId: refs.activeThreadId,
              messageId: refs.currentAssistantId.current,
              eventType: event.event,
              payload: event.data,
              createdAt: new Date().toISOString()
            }
          ]);
        }
      },
      refs.signal
    );
  };

  const submit = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const question = (preset ?? ask).trim();
    if (!question || streaming) return;
    setAsk("");
    setStreaming(true);
    setStreamError("");
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    let id = threadId;
    const timestamp = new Date().toISOString();
    const tempUserId = `tmp-user-${timestamp}`;
    const tempAssistantId = `tmp-assistant-${timestamp}`;
    const optimisticUser: ChatMessage = {
      _id: tempUserId,
      threadId: id ?? "pending",
      role: "user",
      content: question,
      status: "completed",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const optimisticAssistant: ChatMessage = {
      _id: tempAssistantId,
      threadId: id ?? "pending",
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    setLocalMessages((current) => [...current, optimisticUser, optimisticAssistant]);

    const accumulated = { current: "" };
    try {
      id = await ensureThread();
      const activeThreadId = id;
      setLocalMessages((current) => current.map((message) => ({ ...message, threadId: activeThreadId })));
      await consumeStream(
        `/api/chats/${activeThreadId}/messages/stream`,
        { ask: question, model, enableToolApproval: requireApproval },
        {
          accumulated,
          currentAssistantId: { current: tempAssistantId },
          activeThreadId,
          signal: abortController.signal,
          tempUserId,
          tempAssistantId
        }
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        updateAssistant(accumulated.current || "Request cancelled", accumulated.current ? "completed" : "error");
      } else {
        const message = error instanceof Error ? error.message : "Unable to stream chat response";
        setStreamError(message);
        updateAssistant(accumulated.current || message, accumulated.current ? "completed" : "error");
      }
    } finally {
      setStreaming(false);
      if (abortRef.current === abortController) abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      if (id) queryClient.invalidateQueries({ queryKey: ["chat", id] });
    }
  };

  // Approve or deny the pending tool calls and resume the same assistant turn.
  const continueApproval = async (message: ChatMessage, approved: boolean) => {
    if (streaming || !threadId) return;
    const decisions = pendingApprovalsOf(message).map((pending) => ({
      toolCallId: pending.tool_call_id,
      approved
    }));
    if (!decisions.length) return;

    setStreaming(true);
    setStreamError("");
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    // Drop the approval prompt and show the turn resuming.
    patchAssistant({ status: "streaming", metadata: {} });

    const accumulated = { current: "" };
    try {
      await consumeStream(
        `/api/chats/${threadId}/messages/${message._id}/approve`,
        { toolDecisions: decisions, model },
        {
          accumulated,
          currentAssistantId: { current: message._id },
          activeThreadId: threadId,
          signal: abortController.signal
        }
      );
    } catch (error) {
      if (abortController.signal.aborted) {
        updateAssistant(accumulated.current || "Request cancelled", accumulated.current ? "completed" : "error");
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unable to continue after approval";
        setStreamError(errorMessage);
        updateAssistant(accumulated.current || errorMessage, accumulated.current ? "completed" : "error");
      }
    } finally {
      setStreaming(false);
      if (abortRef.current === abortController) abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["chat", threadId] });
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const handleAskKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!ask.trim() || streaming) return;
    void submit();
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 330px", minHeight: "100vh" }}>
      <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography variant="h4">HolmesGPT Chat</Typography>
            <Chip size="small" label="Agent" />
            <Chip size="small" color="primary" variant="outlined" label="HolmesAgent" />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Pause Holmes before it runs commands that need approval (e.g. shell), so you can approve or deny them">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={requireApproval}
                    onChange={(event) => setRequireApproval(event.target.checked)}
                  />
                }
                label="Tool approval"
                slotProps={{ typography: { variant: "body2" } }}
                sx={{ mr: 0 }}
              />
            </Tooltip>
            <Select
              value={modelOptions.includes(model) ? model : modelOptions[0] ?? ""}
              onChange={(event) => setModel(event.target.value)}
              sx={{ minWidth: 150 }}
            >
              {modelOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                void createThread.mutateAsync().then((payload) => navigate(`/chat/${payload.thread._id}`));
              }}
            >
              New chat
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {!localMessages.length ? (
            <Stack sx={{ minHeight: "65vh" }} alignItems="center" justifyContent="center" spacing={3}>
              <Stack alignItems="center" spacing={1}>
                <SmartToyIcon sx={{ fontSize: 42, color: "secondary.main" }} />
                <Typography variant="h4">Meet Holmes, your SRE Agent</Typography>
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ width: "100%", maxWidth: 860 }}>
                {promptCards.map((card) => (
                  <Paper
                    key={card.title}
                    elevation={0}
                    onClick={(event) => void submit(event, card.text)}
                    sx={{
                      flex: 1,
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      cursor: "pointer",
                      "&:hover": { borderColor: "primary.main", bgcolor: "#f9fbff" }
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={800}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {card.text}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2.5} sx={{ maxWidth: 980, mx: "auto" }}>
              {localMessages.map((message) => {
                const assistant = message.role === "assistant";
                return (
                  <Stack key={message._id} alignItems={assistant ? "flex-start" : "flex-end"} spacing={1}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: assistant ? 0 : 1.5,
                        maxWidth: assistant ? "100%" : "78%",
                        bgcolor: assistant ? "transparent" : "#f4f7fb",
                        borderRadius: 2
                      }}
                    >
                      {assistant ? (
                        <Stack spacing={1.5}>
                          <MarkdownMessage
                            content={message.content || (streaming ? "Thinking..." : "")}
                            graphs={(message.metadata as { graphs?: Record<string, GraphData> } | undefined)?.graphs}
                          />
                          {streaming && message.status === "streaming" ? (
                            <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                              <CircularProgress size={14} />
                              <Typography variant="caption">Holmes is investigating</Typography>
                            </Stack>
                          ) : null}
                          <ToolTimeline events={selectedEventsByMessage.get(message._id) ?? localEvents.slice(-8)} />
                          {message.status === "awaiting_approval" ? (
                            <Paper
                              variant="outlined"
                              sx={{ p: 1.5, borderColor: "warning.main", bgcolor: "#fff8e1" }}
                            >
                              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                                Holmes needs approval to run {pendingApprovalsOf(message).length === 1 ? "a command" : "commands"}
                              </Typography>
                              <Stack spacing={1}>
                                {pendingApprovalsOf(message).map((pending) => (
                                  <Box
                                    key={pending.tool_call_id}
                                    sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1, bgcolor: "background.paper" }}
                                  >
                                    <Typography variant="caption" color="text.secondary" fontWeight={800}>
                                      {pending.tool_name ?? "tool"}
                                    </Typography>
                                    <Typography
                                      component="pre"
                                      variant="caption"
                                      sx={{ whiteSpace: "pre-wrap", m: 0, mt: 0.5 }}
                                    >
                                      {pending.description ||
                                        (pending.params?.command as string | undefined) ||
                                        JSON.stringify(pending.params ?? {}, null, 2)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircleIcon />}
                                  disabled={streaming}
                                  onClick={() => void continueApproval(message, true)}
                                >
                                  Approve &amp; run
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<BlockIcon />}
                                  disabled={streaming}
                                  onClick={() => void continueApproval(message, false)}
                                >
                                  Deny
                                </Button>
                              </Stack>
                            </Paper>
                          ) : null}
                          {message.content && message.status !== "awaiting_approval" ? (
                            <Button
                              size="small"
                              startIcon={<SaveIcon />}
                              onClick={() => saveKnowledge.mutate(message)}
                              sx={{ alignSelf: "flex-start" }}
                            >
                              Save as skill
                            </Button>
                          ) : null}
                        </Stack>
                      ) : (
                        <Typography variant="body2">{message.content}</Typography>
                      )}
                    </Paper>
                    {message.status === "error" ? <Chip size="small" color="error" label="Error" /> : null}
                  </Stack>
                );
              })}
              <Box ref={scrollRef} />
            </Stack>
          )}
        </Box>

        <Box sx={{ px: 3, pb: 2.5 }}>
          {streamError ? (
            <Typography variant="body2" color="error" sx={{ maxWidth: 900, mx: "auto", mb: 1 }}>
              {streamError}
            </Typography>
          ) : null}
          <Paper
            component="form"
            onSubmit={(event) => void submit(event)}
            elevation={0}
            sx={{
              maxWidth: 900,
              mx: "auto",
              p: 1,
              border: "1px solid",
              borderColor: streaming ? "primary.main" : "divider"
            }}
          >
            <TextField
              value={ask}
              onChange={(event) => setAsk(event.target.value)}
              onKeyDown={handleAskKeyDown}
              placeholder="Ask anything. Use @ to reference resources or alerts."
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              variant="standard"
              InputProps={{
                disableUnderline: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={streaming ? "Stop" : "Send"}>
                      <span>
                        <IconButton
                          type={streaming ? "button" : "submit"}
                          color={streaming ? "error" : "primary"}
                          disabled={!streaming && !ask.trim()}
                          onClick={streaming ? stopStreaming : undefined}
                        >
                          {streaming ? <StopCircleOutlinedIcon /> : <ArrowUpwardIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
          </Paper>
        </Box>
      </Box>

      <Box sx={{ borderLeft: "1px solid", borderColor: "divider", bgcolor: "background.paper", height: "100vh", overflow: "hidden" }}>
        <Stack sx={{ height: "100%" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography variant="h5">Chats</Typography>
            <Tooltip title="New chat">
              <IconButton
                onClick={() => {
                  void createThread.mutateAsync().then((payload) => navigate(`/chat/${payload.thread._id}`));
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              fullWidth
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
            />
          </Box>
          <Divider />
          <List dense sx={{ overflowY: "auto", flex: 1, p: 1 }}>
            {(threadsQuery.data?.threads ?? []).map((thread) => (
              <ListItemButton
                key={thread._id}
                selected={thread._id === threadId}
                onClick={() => navigate(`/chat/${thread._id}`)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <StarBorderIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={thread.title}
                  secondary={thread.model || settingsQuery.data?.settings.defaultModel}
                  primaryTypographyProps={{ noWrap: true, fontWeight: 700, fontSize: 13 }}
                  secondaryTypographyProps={{ noWrap: true, fontSize: 12 }}
                />
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteThread.mutate(thread._id);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        </Stack>
      </Box>
    </Box>
  );
}
