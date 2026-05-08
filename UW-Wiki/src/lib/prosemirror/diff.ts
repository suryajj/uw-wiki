import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";
import { extractPlainText } from "@/lib/prosemirror/sections";

export type DiffSegment = {
  kind: "context" | "added" | "removed";
  text: string;
};

/**
 * Best-effort word-level diff between two ProseMirror docs. We avoid pulling
 * in `prosemirror-changeset` at the API layer because the patch format is
 * tied to ProseMirror schema instances; the reviewer UI just needs human
 * readable inline diff segments.
 */
export function diffSections(
  original: ProseMirrorDoc | ProseMirrorNode | null,
  proposed: ProseMirrorDoc | ProseMirrorNode,
): DiffSegment[] {
  const before = original ? toPlain(original) : "";
  const after = toPlain(proposed);
  return diffWords(before, after);
}

function toPlain(node: ProseMirrorDoc | ProseMirrorNode): string {
  return extractPlainText(node).replace(/\s+/g, " ").trim();
}

function diffWords(before: string, after: string): DiffSegment[] {
  const beforeTokens = tokenize(before);
  const afterTokens = tokenize(after);
  const lcs = longestCommonSubsequence(beforeTokens, afterTokens);

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  let k = 0;

  function pushSegment(kind: DiffSegment["kind"], text: string) {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.text += text;
    } else {
      segments.push({ kind, text });
    }
  }

  while (k < lcs.length) {
    const token = lcs[k];
    while (i < beforeTokens.length && beforeTokens[i] !== token) {
      pushSegment("removed", beforeTokens[i]);
      i += 1;
    }
    while (j < afterTokens.length && afterTokens[j] !== token) {
      pushSegment("added", afterTokens[j]);
      j += 1;
    }
    pushSegment("context", token);
    i += 1;
    j += 1;
    k += 1;
  }
  while (i < beforeTokens.length) {
    pushSegment("removed", beforeTokens[i]);
    i += 1;
  }
  while (j < afterTokens.length) {
    pushSegment("added", afterTokens[j]);
    j += 1;
  }
  return segments;
}

function tokenize(input: string): string[] {
  if (!input) return [];
  return input.match(/\s+|[^\s]+/g) ?? [];
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: string[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return result;
}
