import "server-only";

import { createHash } from "node:crypto";

import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";

/**
 * Stable SHA-256 hash of a ProseMirror node tree, with the volatile
 * `attrs.official` flag stripped so contributors cannot influence the hash
 * by toggling that attribute. Server-only because Webpack cannot bundle
 * `node:crypto` for the client.
 */
export function hashSection(node: ProseMirrorNode | ProseMirrorDoc): string {
  const normalized = JSON.stringify(stripVolatile(node));
  return createHash("sha256").update(normalized).digest("hex");
}

function stripVolatile(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripVolatile);
  if (node && typeof node === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "attrs" && value && typeof value === "object") {
        const attrs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (k === "official") continue;
          attrs[k] = v;
        }
        result[key] = attrs;
      } else {
        result[key] = stripVolatile(value);
      }
    }
    return result;
  }
  return node;
}
