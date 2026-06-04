import { KnowledgeEntry } from "../models/KnowledgeEntry.js";

// Guardrails so accumulated/"saved as skill" entries can't quietly bloat every
// Holmes request and degrade answer quality. Newest entries win when over budget.
const MAX_ENTRIES = 20;
const MAX_ENTRY_CHARS = 4_000;
const MAX_TOTAL_CHARS = 24_000;

export async function buildAdditionalSystemPrompt() {
  const entries = await KnowledgeEntry.find({ enabled: true })
    .sort({ scope: 1, updatedAt: -1 })
    .limit(MAX_ENTRIES)
    .lean();
  if (entries.length === 0) return undefined;

  const blocks: string[] = [];
  let total = 0;
  for (const entry of entries) {
    const label = entry.type === "skill" ? "Skill" : "Instruction";
    const content =
      entry.content.length > MAX_ENTRY_CHARS
        ? `${entry.content.slice(0, MAX_ENTRY_CHARS)}\n…(truncated)`
        : entry.content;
    const block = `### ${entry.title} (${label}, ${entry.scope})\n${content}`;
    if (total + block.length > MAX_TOTAL_CHARS) break;
    blocks.push(block);
    total += block.length;
  }

  if (blocks.length === 0) return undefined;

  return [
    "Additional context supplied by Holmes UI. Use it when it is relevant to the user's request.",
    ...blocks
  ].join("\n\n");
}
