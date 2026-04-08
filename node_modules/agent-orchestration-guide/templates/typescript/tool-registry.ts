/**
 * Tool Registry — TypeScript Template
 *
 * A type-safe tool registry with schema validation, permission checking,
 * and the buildTool factory pattern.
 *
 * Install: npm install zod
 */

import { z, ZodType } from "zod";

// --- Core Types ---

type PermissionBehavior =
  | { behavior: "allow" }
  | { behavior: "ask"; message: string }
  | { behavior: "deny"; message: string };

interface ToolContext {
  permissionMode: "default" | "plan" | "auto" | "bypass";
  allowRules: string[];
  denyRules: string[];
  readFileState: Map<string, { content: string; mtime: number }>;
}

interface ToolResult<T = unknown> {
  data: T;
}

interface ToolDefinition<TInput extends ZodType = ZodType> {
  name: string;
  description: string;
  inputSchema: TInput;
  isReadOnly?: (input: z.infer<TInput>) => boolean;
  isConcurrencySafe?: (input: z.infer<TInput>) => boolean;
  isDestructive?: (input: z.infer<TInput>) => boolean;
  checkPermissions?: (
    input: z.infer<TInput>,
    ctx: ToolContext
  ) => PermissionBehavior;
  execute: (
    input: z.infer<TInput>,
    ctx: ToolContext
  ) => Promise<ToolResult>;
  maxResultSize?: number;
}

interface Tool<TInput extends ZodType = ZodType> {
  name: string;
  description: string;
  inputSchema: TInput;
  isReadOnly: (input: z.infer<TInput>) => boolean;
  isConcurrencySafe: (input: z.infer<TInput>) => boolean;
  isDestructive: (input: z.infer<TInput>) => boolean;
  checkPermissions: (
    input: z.infer<TInput>,
    ctx: ToolContext
  ) => PermissionBehavior;
  execute: (
    input: z.infer<TInput>,
    ctx: ToolContext
  ) => Promise<ToolResult>;
  maxResultSize: number;

  toAPISchema(): { name: string; description: string; input_schema: unknown };
  validateInput(raw: unknown): { valid: true; data: z.infer<TInput> } | { valid: false; error: string };
}

// --- buildTool Factory ---

function buildTool<TInput extends ZodType>(
  def: ToolDefinition<TInput>
): Tool<TInput> {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,

    isReadOnly: def.isReadOnly ?? (() => false),
    isConcurrencySafe: def.isConcurrencySafe ?? (() => false),
    isDestructive: def.isDestructive ?? (() => false),
    checkPermissions:
      def.checkPermissions ?? (() => ({ behavior: "allow" })),
    execute: def.execute,
    maxResultSize: def.maxResultSize ?? 30_000,

    toAPISchema() {
      return {
        name: def.name,
        description: def.description,
        input_schema: zodToJsonSchema(def.inputSchema),
      };
    },

    validateInput(raw: unknown) {
      const result = def.inputSchema.safeParse(raw);
      if (result.success) {
        return { valid: true, data: result.data };
      }
      return { valid: false, error: result.error.message };
    },
  };
}

// --- Tool Registry ---

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getFiltered(ctx: ToolContext): Tool[] {
    return this.getAll().filter((tool) => {
      if (ctx.denyRules.some((rule) => matchesGlob(rule, tool.name))) {
        return false;
      }
      if (ctx.permissionMode === "plan" && !tool.isReadOnly({})) {
        return false;
      }
      return true;
    });
  }

  getAPISchemas(ctx: ToolContext): unknown[] {
    return this.getFiltered(ctx)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => t.toAPISchema());
  }

  search(query: string): Tool[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower)
    );
  }
}

// --- Helper: Glob Matching ---

function matchesGlob(pattern: string, value: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
  );
  return regex.test(value);
}

// --- Helper: Zod to JSON Schema (simplified) ---

function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  const jsonSchema = JSON.parse(JSON.stringify(schema));
  return jsonSchema;
}

// --- Example: Define Tools ---

const FileReadTool = buildTool({
  name: "FileRead",
  description: "Read the contents of a file at the specified path",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file"),
    offset: z.number().optional().describe("Line to start from"),
    limit: z.number().optional().describe("Number of lines to read"),
  }),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  async execute(input, ctx) {
    const fs = await import("fs/promises");
    const content = await fs.readFile(input.path, "utf-8");
    ctx.readFileState.set(input.path, {
      content,
      mtime: Date.now(),
    });

    const lines = content.split("\n");
    const start = (input.offset ?? 1) - 1;
    const end = input.limit ? start + input.limit : lines.length;
    const selected = lines.slice(start, end);

    return {
      data: selected
        .map((line, i) => `${String(start + i + 1).padStart(6)}|${line}`)
        .join("\n"),
    };
  },
});

const FileEditTool = buildTool({
  name: "FileEdit",
  description: "Edit a file by replacing an exact string match",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file"),
    old_string: z.string().describe("The exact string to find and replace"),
    new_string: z.string().describe("The replacement string"),
  }),
  isReadOnly: () => false,
  isDestructive: () => false,
  checkPermissions(input, ctx) {
    if (!ctx.readFileState.has(input.path)) {
      return {
        behavior: "deny",
        message: "File must be read before editing",
      };
    }
    if (ctx.permissionMode === "plan") {
      return {
        behavior: "deny",
        message: "Edits not allowed in plan mode",
      };
    }
    return { behavior: "ask", message: `Edit ${input.path}?` };
  },
  async execute(input) {
    const fs = await import("fs/promises");
    const content = await fs.readFile(input.path, "utf-8");
    const occurrences = content.split(input.old_string).length - 1;

    if (occurrences === 0) {
      throw new Error("old_string not found in file");
    }
    if (occurrences > 1) {
      throw new Error(
        `old_string found ${occurrences} times — must be unique`
      );
    }

    const updated = content.replace(input.old_string, input.new_string);
    await fs.writeFile(input.path, updated, "utf-8");
    return { data: "File edited successfully" };
  },
});

// --- Example: Build a Registry ---

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(FileReadTool);
  registry.register(FileEditTool);
  return registry;
}
