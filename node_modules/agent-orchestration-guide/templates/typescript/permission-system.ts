/**
 * Permission System — TypeScript Template
 *
 * Implements tiered permissions with rule-based access control,
 * permission dialogs, and mode-based filtering.
 */

// --- Types ---

type PermissionTier = "auto" | "ask-once" | "ask-always" | "deny";

type PermissionMode = "default" | "plan" | "auto-accept" | "bypass";

interface PermissionRule {
  tool: string;
  path?: string;
  action: "allow" | "deny" | "ask";
}

interface PermissionContext {
  mode: PermissionMode;
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
  sessionApprovals: Set<string>;
}

type PermissionDecision =
  | { behavior: "allow" }
  | { behavior: "ask"; message: string }
  | { behavior: "deny"; message: string };

interface ToolPermissionInfo {
  name: string;
  defaultTier: PermissionTier;
  isReadOnly: boolean;
  getPath?: (input: Record<string, unknown>) => string | undefined;
}

// --- Permission Checker ---

export class PermissionChecker {
  private context: PermissionContext;
  private requestApproval: (
    toolName: string,
    message: string
  ) => Promise<"approve" | "approve-always" | "deny" | "deny-always">;

  constructor(
    context: PermissionContext,
    requestApproval: (
      toolName: string,
      message: string
    ) => Promise<"approve" | "approve-always" | "deny" | "deny-always">
  ) {
    this.context = context;
    this.requestApproval = requestApproval;
  }

  check(
    tool: ToolPermissionInfo,
    input: Record<string, unknown>
  ): PermissionDecision {
    const toolPath = tool.getPath?.(input);
    const matchKey = toolPath
      ? `${tool.name}:${toolPath}`
      : tool.name;

    // 1. Bypass mode — allow everything
    if (this.context.mode === "bypass") {
      return { behavior: "allow" };
    }

    // 2. Plan mode — only read-only tools
    if (this.context.mode === "plan" && !tool.isReadOnly) {
      return {
        behavior: "deny",
        message: "Write operations are not allowed in plan mode",
      };
    }

    // 3. Check deny rules (highest priority)
    for (const rule of this.context.denyRules) {
      if (matchesRule(rule, tool.name, toolPath)) {
        return {
          behavior: "deny",
          message: `Blocked by deny rule: ${rule.tool}${rule.path ? ` (${rule.path})` : ""}`,
        };
      }
    }

    // 4. Check allow rules
    for (const rule of this.context.allowRules) {
      if (matchesRule(rule, tool.name, toolPath)) {
        return { behavior: "allow" };
      }
    }

    // 5. Auto-accept mode — allow non-denied tools
    if (this.context.mode === "auto-accept") {
      return { behavior: "allow" };
    }

    // 6. Check session approvals (ask-once pattern)
    if (this.context.sessionApprovals.has(matchKey)) {
      return { behavior: "allow" };
    }

    // 7. Apply default tier
    switch (tool.defaultTier) {
      case "auto":
        return { behavior: "allow" };
      case "deny":
        return {
          behavior: "deny",
          message: `${tool.name} is denied by default`,
        };
      case "ask-once":
      case "ask-always":
        return {
          behavior: "ask",
          message: `${tool.name} wants to ${tool.isReadOnly ? "read" : "modify"}: ${toolPath ?? "unknown"}`,
        };
    }
  }

  async handleAsk(
    tool: ToolPermissionInfo,
    input: Record<string, unknown>,
    message: string
  ): Promise<PermissionDecision> {
    const toolPath = tool.getPath?.(input);
    const matchKey = toolPath
      ? `${tool.name}:${toolPath}`
      : tool.name;

    const decision = await this.requestApproval(tool.name, message);

    switch (decision) {
      case "approve":
        if (tool.defaultTier === "ask-once") {
          this.context.sessionApprovals.add(matchKey);
        }
        return { behavior: "allow" };

      case "approve-always":
        this.context.allowRules.push({
          tool: tool.name,
          path: toolPath,
          action: "allow",
        });
        return { behavior: "allow" };

      case "deny":
        return { behavior: "deny", message: "User denied this operation" };

      case "deny-always":
        this.context.denyRules.push({
          tool: tool.name,
          path: toolPath,
          action: "deny",
        });
        return {
          behavior: "deny",
          message: "User permanently denied this operation",
        };
    }
  }
}

// --- Rule Matching ---

function matchesRule(
  rule: PermissionRule,
  toolName: string,
  path?: string
): boolean {
  if (!globMatch(rule.tool, toolName)) return false;
  if (rule.path && path && !globMatch(rule.path, path)) return false;
  if (rule.path && !path) return false;
  return true;
}

function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§DOUBLESTAR§")
    .replace(/\*/g, "[^/]*")
    .replace(/§DOUBLESTAR§/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(value);
}

// --- Layered Settings ---

interface PermissionSettings {
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
}

export function mergePermissionSettings(
  ...layers: PermissionSettings[]
): PermissionSettings {
  const merged: PermissionSettings = { allowRules: [], denyRules: [] };
  for (const layer of layers) {
    merged.allowRules.push(...layer.allowRules);
    merged.denyRules.push(...layer.denyRules);
  }
  return merged;
}

export function loadPermissionSettings(
  paths: string[]
): PermissionSettings {
  const layers: PermissionSettings[] = [];
  for (const p of paths) {
    try {
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(p, "utf-8"));
      layers.push({
        allowRules: data.allowRules ?? [],
        denyRules: data.denyRules ?? [],
      });
    } catch {
      // File doesn't exist or is invalid — skip this layer
    }
  }
  return mergePermissionSettings(...layers);
}

// --- Example Usage ---

function example() {
  const context: PermissionContext = {
    mode: "default",
    allowRules: [
      { tool: "FileRead", action: "allow" },
      { tool: "Bash", path: "npm test", action: "allow" },
    ],
    denyRules: [
      { tool: "Bash", path: "rm -rf *", action: "deny" },
    ],
    sessionApprovals: new Set(),
  };

  const checker = new PermissionChecker(context, async (toolName, message) => {
    console.log(`[Permission] ${toolName}: ${message}`);
    return "approve"; // In a real app, show a dialog
  });

  const fileReadInfo: ToolPermissionInfo = {
    name: "FileRead",
    defaultTier: "auto",
    isReadOnly: true,
    getPath: (input) => input.path as string,
  };

  const decision = checker.check(fileReadInfo, { path: "/src/index.ts" });
  console.log(decision); // { behavior: "allow" }
}
