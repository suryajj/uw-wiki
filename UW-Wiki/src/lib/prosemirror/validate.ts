import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";

const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);

const ALLOWED_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
  "highlight",
]);

const ALLOWED_NODE_KEYS = new Set(["type", "attrs", "content", "marks", "text"]);
const ALLOWED_MARK_KEYS = new Set(["type", "attrs"]);
const ALLOWED_LINK_ATTR_KEYS = new Set(["href", "target", "rel"]);

const ALLOWED_HEADING_LEVELS = new Set([2, 3]);
const SECTION_HEADING_LEVELS = new Set([2]);

const ALLOWED_IMAGE_SRC =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/|^\//i;
// Reject protocol-relative `//host` and unknown schemes; accept only http(s)
// and absolute paths starting with a single `/`.
const ALLOWED_LINK_HREF = /^https?:\/\/[^\s]+$|^\/[^/][^\s]*$|^\/$/i;

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

export function validateProposalDoc(doc: unknown): ValidationResult {
  if (!isObject(doc)) return fail("Expected a ProseMirror document object.");
  const root = doc as ProseMirrorDoc;
  if (root.type !== "doc") return fail("Root node must have type 'doc'.");
  return validateNode(root, true);
}

export function validateProposalSection(node: unknown): ValidationResult {
  if (!isObject(node)) return fail("Expected a ProseMirror node.");
  const heading = node as ProseMirrorNode;
  if (heading.type !== "heading") {
    return fail("Section root node must be a heading node.");
  }
  if (!SECTION_HEADING_LEVELS.has(Number(heading.attrs?.level))) {
    return fail("Section heading must be level 2.");
  }
  if (typeof heading.attrs?.slug !== "string" || !heading.attrs.slug) {
    return fail("Section heading must include attrs.slug.");
  }
  if ("official" in (heading.attrs ?? {})) {
    return fail("Contributors cannot toggle attrs.official on a section heading.");
  }
  return validateNode(heading, false);
}

function validateNode(
  node: ProseMirrorNode,
  isRoot: boolean,
): ValidationResult {
  if (!isObject(node)) return fail("Encountered a non-object node.");

  for (const key of Object.keys(node)) {
    if (!ALLOWED_NODE_KEYS.has(key)) {
      return fail(`Unexpected key '${key}' on node.`);
    }
  }

  if (typeof node.type !== "string") return fail("Each node must have a type.");

  if (!ALLOWED_NODES.has(node.type)) {
    return fail(`Node type '${node.type}' is not allowed.`);
  }

  if (node.type === "heading") {
    const level = Number(node.attrs?.level);
    if (isRoot ? !ALLOWED_HEADING_LEVELS.has(level) : !SECTION_HEADING_LEVELS.has(level)) {
      return fail("Heading nodes must be level 2 or 3.");
    }
    if (node.attrs && "official" in node.attrs) {
      return fail("Contributors cannot toggle attrs.official on a section heading.");
    }
  }

  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "");
    if (!ALLOWED_IMAGE_SRC.test(src)) {
      return fail("Image src must be a Supabase Storage URL or relative path.");
    }
  }

  if (node.marks) {
    if (!Array.isArray(node.marks)) return fail("marks must be an array.");
    for (const mark of node.marks) {
      const result = validateMark(mark);
      if (!result.ok) return result;
    }
  }

  if (node.content) {
    if (!Array.isArray(node.content)) return fail("content must be an array.");
    for (const child of node.content) {
      const result = validateNode(child as ProseMirrorNode, false);
      if (!result.ok) return result;
    }
  }

  if (node.type === "text" && node.text !== undefined && typeof node.text !== "string") {
    return fail("text node text must be a string.");
  }

  return { ok: true };
}

function validateMark(mark: unknown): ValidationResult {
  if (!isObject(mark)) return fail("Mark must be an object.");
  for (const key of Object.keys(mark)) {
    if (!ALLOWED_MARK_KEYS.has(key)) {
      return fail(`Unexpected key '${key}' on mark.`);
    }
  }
  const m = mark as { type: string; attrs?: Record<string, unknown> };
  if (typeof m.type !== "string") return fail("Mark must have a type.");
  if (!ALLOWED_MARKS.has(m.type)) return fail(`Mark '${m.type}' is not allowed.`);
  if (m.type === "link") {
    if (!m.attrs || typeof m.attrs.href !== "string") {
      return fail("Link mark requires attrs.href.");
    }
    for (const key of Object.keys(m.attrs)) {
      if (!ALLOWED_LINK_ATTR_KEYS.has(key)) {
        return fail(`Unexpected key '${key}' on link mark.`);
      }
    }
    if (!ALLOWED_LINK_HREF.test(m.attrs.href)) {
      return fail("Link href must use http(s) or be an absolute path.");
    }
  }
  return { ok: true };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fail(error: string): ValidationFail {
  return { ok: false, error };
}
