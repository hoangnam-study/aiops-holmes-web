import { describe, expect, it } from "vitest";
import { extractSlackPrompt, extractTeamsPrompt } from "../services/botService.js";

describe("bot prompt extraction", () => {
  it("extracts Slack slash-command text and strips bot mentions", () => {
    const prompt = extractSlackPrompt({
      text: "<@U123> why is checkout failing?",
      user_id: "U456",
      channel_id: "C789",
      team_id: "T000"
    });

    expect(prompt).toMatchObject({
      text: "why is checkout failing?",
      externalUser: "U456",
      externalChannel: "C789",
      externalTeam: "T000"
    });
  });

  it("extracts Teams text and conversation identifiers", () => {
    const prompt = extractTeamsPrompt({
      text: "@Holmes summarize the latest incident",
      from: { id: "user-1" },
      conversation: { id: "conv-1", tenantId: "tenant-1" }
    });

    expect(prompt).toMatchObject({
      text: "summarize the latest incident",
      externalUser: "user-1",
      externalChannel: "conv-1",
      externalTeam: "tenant-1"
    });
  });
});
