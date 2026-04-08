/**
 * Agent Loop — TypeScript Template
 *
 * A minimal but production-ready implementation of the query-execute-observe
 * agent loop. Uses the Anthropic Claude API.
 *
 * Install: npm install @anthropic-ai/sdk
 */

import Anthropic from "@anthropic-ai/sdk";

// --- Types ---

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>): Promise<string>;
}

interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: Tool[];
  maxTurns: number;
  maxBudgetUSD?: number;
}

interface TurnResult {
  response: string;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
}

// --- Agent Loop ---

export class AgentLoop {
  private client: Anthropic;
  private config: AgentConfig;
  private history: Anthropic.MessageParam[] = [];
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  constructor(config: AgentConfig) {
    this.client = new Anthropic();
    this.config = config;
  }

  async run(userInput: string): Promise<TurnResult> {
    this.history.push({ role: "user", content: userInput });

    let turnCount = 0;
    let totalToolCalls = 0;
    let lastTextResponse = "";

    while (turnCount < this.config.maxTurns) {
      turnCount++;

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: this.config.systemPrompt,
        tools: this.config.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
        })),
        messages: this.history,
      });

      this.totalInputTokens += response.usage.input_tokens;
      this.totalOutputTokens += response.usage.output_tokens;

      this.history.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      for (const block of response.content) {
        if (block.type === "text") {
          lastTextResponse = block.text;
        }
      }

      if (toolUseBlocks.length === 0) {
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        totalToolCalls++;
        const tool = this.config.tools.find((t) => t.name === toolUse.name);

        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Error: Unknown tool "${toolUse.name}"`,
            is_error: true,
          });
          continue;
        }

        try {
          const result = await tool.execute(
            toolUse.input as Record<string, unknown>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true,
          });
        }
      }

      this.history.push({ role: "user", content: toolResults });

      if (response.stop_reason === "end_turn") {
        break;
      }
    }

    return {
      response: lastTextResponse,
      toolCalls: totalToolCalls,
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
    };
  }

  get costEstimateUSD(): number {
    const inputCostPer1M = 3.0;
    const outputCostPer1M = 15.0;
    return (
      (this.totalInputTokens / 1_000_000) * inputCostPer1M +
      (this.totalOutputTokens / 1_000_000) * outputCostPer1M
    );
  }
}

// --- Example Usage ---

async function main() {
  const readFileTool: Tool = {
    name: "read_file",
    description: "Read the contents of a file at the specified path",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Path to the file" },
      },
      required: ["path"],
    },
    async execute(input) {
      const fs = await import("fs/promises");
      return await fs.readFile(input.path as string, "utf-8");
    },
  };

  const agent = new AgentLoop({
    model: "claude-sonnet-4-6-20260320",
    systemPrompt: "You are a helpful coding assistant. Use tools to help the user.",
    tools: [readFileTool],
    maxTurns: 10,
  });

  const result = await agent.run("Read the package.json and summarize it");
  console.log(result.response);
  console.log(`Cost: $${agent.costEstimateUSD.toFixed(4)}`);
}

main().catch(console.error);
