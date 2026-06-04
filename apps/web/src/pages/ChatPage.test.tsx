import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatPage from "./ChatPage";
import { apiFetch, postJson } from "../api/client";
import { streamPost } from "../api/stream";
import { theme } from "../theme/theme";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
  deleteJson: vi.fn(),
  postJson: vi.fn()
}));

vi.mock("../api/stream", async () => {
  const actual = await vi.importActual<typeof import("../api/stream")>("../api/stream");
  return { ...actual, streamPost: vi.fn() };
});

Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn()
});

const settings = {
  holmesApiUrl: "https://holmes.observestack.fis-cloud.xplat.online",
  hasHolmesApiKey: false,
  defaultModel: "cloud-escalate",
  timezone: "Asia/Ho_Chi_Minh"
};

const thread = {
  _id: "thread-1",
  title: "New chat",
  model: "cloud-escalate",
  visibility: "private",
  archived: false,
  conversationHistory: [],
  createdAt: "2026-06-04T00:00:00.000Z",
  updatedAt: "2026-06-04T00:00:00.000Z"
};

function renderChatPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/chat"]}>
          <ChatPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe("ChatPage composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/settings") return { settings };
      if (url === "/api/holmes/models") return { models: ["cloud-escalate"], defaultModel: "cloud-escalate" };
      if (url === "/api/chats") return { threads: [] };
      if (url === "/api/chats/thread-1") return { thread, messages: [], events: [] };
      throw new Error(`Unexpected apiFetch call: ${url}`);
    });
    vi.mocked(postJson).mockImplementation(async (url) => {
      if (url === "/api/chats") return { thread };
      throw new Error(`Unexpected postJson call: ${url}`);
    });
    vi.mocked(streamPost).mockImplementation(async (_url, _body, onEvent) => {
      onEvent({
        event: "chat_metadata",
        data: {
          userMessageId: "user-message-1",
          assistantMessageId: "assistant-message-1"
        }
      });
      onEvent({ event: "ai_answer_end", data: { content: "Done" } });
    });
  });

  it("sends the prompt when Enter is pressed", async () => {
    renderChatPage();

    const input = await screen.findByPlaceholderText("Ask anything. Use @ to reference resources or alerts.");
    fireEvent.change(input, { target: { value: "Check cluster health" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(streamPost).toHaveBeenCalledTimes(1));
    expect(streamPost).toHaveBeenCalledWith(
      "/api/chats/thread-1/messages/stream",
      expect.objectContaining({ ask: "Check cluster health" }),
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("keeps Shift+Enter available for multiline prompts", async () => {
    renderChatPage();

    const input = await screen.findByPlaceholderText("Ask anything. Use @ to reference resources or alerts.");
    fireEvent.change(input, { target: { value: "Line one" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });

    expect(streamPost).not.toHaveBeenCalled();
  });

  it("shows an error when Holmes returns an empty final answer", async () => {
    vi.mocked(streamPost).mockImplementationOnce(async (_url, _body, onEvent) => {
      onEvent({
        event: "chat_metadata",
        data: {
          userMessageId: "user-message-1",
          assistantMessageId: "assistant-message-1"
        }
      });
      onEvent({ event: "ai_answer_end", data: { analysis: null } });
    });

    renderChatPage();

    const input = await screen.findByPlaceholderText("Ask anything. Use @ to reference resources or alerts.");
    fireEvent.change(input, { target: { value: "Tell me rules" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    const emptyResponse = await screen.findByText(/Holmes returned an empty response/);
    expect(emptyResponse.textContent).toMatch(/Holmes returned an empty response/);
  });
});
