/**
 * Sub-Agent — TypeScript Template
 *
 * Implements the AgentTool pattern: a tool that spawns an independent agent
 * instance with its own context, tools, and constraints.
 *
 * Install: npm install @anthropic-ai/sdk zod
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// --- Types ---

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>): Promise<string>;
}

interface AgentDefinition {
  name: string;
  systemPrompt: string;
  tools: Tool[];
  model?: string;
  maxTurns?: number;
}

interface SubAgentResult {
  agentName: string;
  response: string;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
}

// --- Sub-Agent Runner ---

async function runSubAgent(
  definition: AgentDefinition,
  task: string
): Promise<SubAgentResult> {
  const client = new Anthropic();
  const model = definition.model ?? "claude-sonnet-4-6-20260320";
  const maxTurns = definition.maxTurns ?? 10;
  const history: Anthropic.MessageParam[] = [
    { role: "user", content: task },
  ];

  let turnCount = 0;
  let totalToolCalls = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let lastText = "";

  while (turnCount < maxTurns) {
    turnCount++;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: definition.systemPrompt,
      tools: definition.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
      })),
      messages: history,
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;
    history.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    for (const b of response.content) {
      if (b.type === "text") lastText = b.text;
    }

    if (toolUses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      totalToolCalls++;
      const tool = definition.tools.find((t) => t.name === tu.name);
      if (!tool) {
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unknown tool: ${tu.name}`,
          is_error: true,
        });
        continue;
      }
      try {
        const out = await tool.execute(tu.input as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      } catch (e) {
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${e instanceof Error ? e.message : String(e)}`,
          is_error: true,
        });
      }
    }
    history.push({ role: "user", content: results });
  }

  return {
    agentName: definition.name,
    response: lastText,
    toolCalls: totalToolCalls,
    inputTokens: totalInput,
    outputTokens: totalOutput,
  };
}

// --- Agent Tool (for parent agent to call) ---

const AgentToolInputSchema = z.object({
  task: z.string().describe("The task to delegate to the sub-agent"),
  agentType: z
    .string()
    .optional()
    .describe("Which agent definition to use (default: general)"),
});

function createAgentTool(agents: Map<string, AgentDefinition>): Tool {
  return {
    name: "Agent",
    description:
      "Spawn a sub-agent to handle a specific task. " +
      "Use this for tasks that benefit from a focused context or parallel execution.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task to delegate to the sub-agent",
        },
        agentType: {
          type: "string",
          description: "Which agent definition to use",
        },
      },
      required: ["task"],
    },
    async execute(input) {
      const agentType = (input.agentType as string) ?? "general";
      const definition = agents.get(agentType);
      if (!definition) {
        throw new Error(
          `Unknown agent type: "${agentType}". Available: ${Array.from(agents.keys()).join(", ")}`
        );
      }
      const result = await runSubAgent(definition, input.task as string);
      return `[Sub-agent "${result.agentName}" completed: ${result.toolCalls} tool calls]\n\n${result.response}`;
    },
  };
}

// --- Fan-Out / Fan-In Pattern ---

async function fanOutFanIn(
  tasks: Array<{ definition: AgentDefinition; task: string }>
): Promise<SubAgentResult[]> {
  return Promise.all(
    tasks.map(({ definition, task }) => runSubAgent(definition, task))
  );
}

// --- Example: Coordinator Pattern ---

async function coordinatorExample() {
  const readOnlyTools: Tool[] = [
    {
      name: "read_file",
      description: "Read file contents",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
      async execute(input) {
        const fs = await import("fs/promises");
        return fs.readFile(input.path as string, "utf-8");
      },
    },
  ];

  const agents = new Map<string, AgentDefinition>([
    [
      "researcher",
      {
        name: "researcher",
        systemPrompt:
          "You research codebases. Read files, understand structure, and report findings.",
        tools: readOnlyTools,
        maxTurns: 5,
      },
    ],
    [
      "general",
      {
        name: "general",
        systemPrompt: "You are a general-purpose coding assistant.",
        tools: readOnlyTools,
        maxTurns: 5,
      },
    ],
  ]);

  const agentTool = createAgentTool(agents);

  // The coordinator would use this tool in its agent loop
  const result = await agentTool.execute({
    task: "Read package.json and summarize the project dependencies",
    agentType: "researcher",
  });

  console.log(result);
}

export { runSubAgent, createAgentTool, fanOutFanIn };
