import { Router } from "express";
import { env } from "../config/env.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { extractSlackPrompt, extractTeamsPrompt, runBotPrompt } from "../services/botService.js";

const router = Router();

function assertBotToken(req: { headers: Record<string, unknown>; query: Record<string, unknown> }) {
  if (!env.BOT_WEBHOOK_TOKEN) return;
  const header = typeof req.headers["x-bot-webhook-token"] === "string" ? req.headers["x-bot-webhook-token"] : "";
  const auth = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  if (![header, bearer, queryToken].includes(env.BOT_WEBHOOK_TOKEN)) {
    throw new ApiError(401, "Invalid bot webhook token");
  }
}

router.post(
  "/slack/events",
  asyncHandler(async (req, res) => {
    assertBotToken(req);
    if (req.body?.type === "url_verification" && req.body.challenge) {
      res.json({ challenge: req.body.challenge });
      return;
    }
    const prompt = extractSlackPrompt(req.body ?? {});
    const result = await runBotPrompt("slack", prompt);
    res.json({
      response_type: "in_channel",
      text: result.answer,
      threadId: String(result.thread._id)
    });
  })
);

router.post(
  "/teams/messages",
  asyncHandler(async (req, res) => {
    assertBotToken(req);
    const prompt = extractTeamsPrompt(req.body ?? {});
    const result = await runBotPrompt("teams", prompt);
    res.json({
      type: "message",
      text: result.answer,
      threadId: String(result.thread._id)
    });
  })
);

export default router;
