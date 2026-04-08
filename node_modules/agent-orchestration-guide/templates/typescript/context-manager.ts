/**
 * Context Manager — TypeScript Template
 *
 * Manages the context window: token tracking, budget enforcement,
 * compaction, and history management.
 *
 * Install: npm install @anthropic-ai/sdk
 */

import Anthropic from "@anthropic-ai/sdk";

// --- Types ---

interface TokenBudget {
  maxTokens: number;
  systemPromptTokens: number;
  toolDefinitionTokens: number;
  reservedForResponse: number;
  historyTokens: number;
}

interface CompactionResult {
  originalMessages: number;
  compactedMessages: number;
  tokensSaved: number;
}

// --- Token Estimation ---

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateMessageTokens(msg: Anthropic.MessageParam): number {
  if (typeof msg.content === "string") {
    return estimateTokens(msg.content);
  }
  let total = 0;
  for (const block of msg.content) {
    if ("text" in block && typeof block.text === "string") {
      total += estimateTokens(block.text);
    } else if ("content" in block && typeof block.content === "string") {
      total += estimateTokens(block.content);
    }
  }
  return total;
}

// --- Context Manager ---

export class ContextManager {
  private history: Anthropic.MessageParam[] = [];
  private systemPrompt: string;
  private maxContextTokens: number;
  private compactionThreshold: number;

  constructor(options: {
    systemPrompt: string;
    maxContextTokens?: number;
    compactionThreshold?: number;
  }) {
    this.systemPrompt = options.systemPrompt;
    this.maxContextTokens = options.maxContextTokens ?? 200_000;
    this.compactionThreshold = options.compactionThreshold ?? 0.8;
  }

  addMessage(message: Anthropic.MessageParam): void {
    this.history.push(message);
  }

  getHistory(): Anthropic.MessageParam[] {
    return [...this.history];
  }

  getTokenBudget(): TokenBudget {
    const systemPromptTokens = estimateTokens(this.systemPrompt);
    const toolDefinitionTokens = 0; // caller provides separately
    const reservedForResponse = Math.floor(this.maxContextTokens * 0.05);
    const historyTokens = this.history.reduce(
      (sum, msg) => sum + estimateMessageTokens(msg),
      0
    );

    return {
      maxTokens: this.maxContextTokens,
      systemPromptTokens,
      toolDefinitionTokens,
      reservedForResponse,
      historyTokens,
    };
  }

  get usageRatio(): number {
    const budget = this.getTokenBudget();
    const used =
      budget.systemPromptTokens +
      budget.toolDefinitionTokens +
      budget.historyTokens +
      budget.reservedForResponse;
    return used / budget.maxTokens;
  }

  shouldCompact(): boolean {
    return this.usageRatio >= this.compactionThreshold;
  }

  /**
   * Micro-compaction: truncate oversized tool results in-place.
   * Returns number of messages truncated.
   */
  microCompact(maxResultChars: number = 10_000): number {
    let truncated = 0;

    for (const msg of this.history) {
      if (typeof msg.content !== "string" && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (
            "type" in block &&
            block.type === "tool_result" &&
            "content" in block &&
            typeof block.content === "string" &&
            block.content.length > maxResultChars
          ) {
            const half = Math.floor(maxResultChars / 2);
            (block as { content: string }).content =
              block.content.slice(0, half) +
              `\n\n... [truncated ${block.content.length - maxResultChars} characters] ...\n\n` +
              block.content.slice(-half);
            truncated++;
          }
        }
      }
    }
    return truncated;
  }

  /**
   * Full compaction: summarize older messages, keep recent ones.
   * Uses the LLM to generate a summary.
   */
  async fullCompact(
    client: Anthropic,
    model: string,
    keepRecentTurns: number = 4
  ): Promise<CompactionResult> {
    const originalCount = this.history.length;

    if (originalCount <= keepRecentTurns * 2) {
      return {
        originalMessages: originalCount,
        compactedMessages: originalCount,
        tokensSaved: 0,
      };
    }

    const oldMessages = this.history.slice(0, -keepRecentTurns * 2);
    const recentMessages = this.history.slice(-keepRecentTurns * 2);

    const oldTokens = oldMessages.reduce(
      (sum, m) => sum + estimateMessageTokens(m),
      0
    );

    const summaryPrompt = `Summarize the following conversation history concisely. 
Preserve: key decisions, files modified, errors encountered, current task state.
Discard: verbose tool outputs, redundant information.

${oldMessages.map((m) => `[${m.role}]: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content).slice(0, 500)}`).join("\n\n")}`;

    const summaryResponse = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: summaryPrompt }],
    });

    const summaryText =
      summaryResponse.content[0].type === "text"
        ? summaryResponse.content[0].text
        : "";

    this.history = [
      {
        role: "user",
        content: `[Conversation summary from earlier in this session]\n\n${summaryText}`,
      },
      {
        role: "assistant",
        content: "Understood. I have the context from the summary. Continuing.",
      },
      ...recentMessages,
    ];

    const newTokens = this.history.reduce(
      (sum, m) => sum + estimateMessageTokens(m),
      0
    );

    return {
      originalMessages: originalCount,
      compactedMessages: this.history.length,
      tokensSaved: oldTokens - estimateTokens(summaryText),
    };
  }

  /**
   * Reset the conversation (e.g., for a new session).
   */
  reset(): void {
    this.history = [];
  }
}

// --- Session Memory (key facts persisted across compaction) ---

export class SessionMemory {
  private facts: Map<string, string> = new Map();

  addFact(key: string, value: string): void {
    this.facts.set(key, value);
  }

  removeFact(key: string): void {
    this.facts.delete(key);
  }

  toPromptSection(): string {
    if (this.facts.size === 0) return "";
    const entries = Array.from(this.facts.entries())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    return `## Session Memory\n\n${entries}`;
  }
}

// --- Long-Term Memory (file-based, persists across sessions) ---

export class LongTermMemory {
  private memoryDir: string;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
  }

  async save(key: string, content: string, tags: string[] = []): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    await fs.mkdir(this.memoryDir, { recursive: true });

    const frontmatter = [
      "---",
      `key: ${key}`,
      `tags: [${tags.join(", ")}]`,
      `created: ${new Date().toISOString()}`,
      "---",
    ].join("\n");

    const filePath = path.join(this.memoryDir, `${key}.md`);
    await fs.writeFile(filePath, `${frontmatter}\n\n${content}`, "utf-8");
  }

  async load(key: string): Promise<string | null> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(this.memoryDir, `${key}.md`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const bodyStart = content.indexOf("---", 3);
      return bodyStart >= 0 ? content.slice(bodyStart + 3).trim() : content;
    } catch {
      return null;
    }
  }

  async listAll(): Promise<string[]> {
    const fs = await import("fs/promises");
    try {
      const files = await fs.readdir(this.memoryDir);
      return files
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(".md", ""));
    } catch {
      return [];
    }
  }
}
