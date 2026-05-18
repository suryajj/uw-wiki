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
  "citation",
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
// `class` and `title` are declared by the TipTap Link extension's
// addAttributes() (class defaults from `HTMLAttributes.class` in
// extensions.ts). When a contributor edits an article and the link mark
// round-trips through the editor, those attrs get serialized onto the JSON.
// Without allowing them here, every edit-touched link would fail validation
// with "Unexpected key 'class' on link mark." href is the only one that
// affects rendering security; class/title/target/rel are presentational.
const ALLOWED_LINK_ATTR_KEYS = new Set([
  "href",
  "target",
  "rel",
  "class",
  "title",
]);

const ALLOWED_HEADING_LEVELS = new Set([2, 3]);
const SECTION_HEADING_LEVELS = new Set([2]);

const ALLOWED_IMAGE_SRC =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/|^\//i;
// Reject protocol-relative `//host` and unknown schemes; accept only http(s)
// and absolute paths starting with a single `/`.
const ALLOWED_LINK_HREF =
  /^https?:\/\/[^\s]+$|^mailto:[^\s@]+@[^\s@]+$|^\/[^/][^\s]*$|^\/$/i;

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Walking context kept while we recurse the doc. `path` is a human-readable
 * breadcrumb ("Curriculum > paragraph #2 > link") so error messages can
 * pinpoint the exact spot the contributor needs to fix. `sectionTitle`
 * remembers the last H2 we passed so link errors mention which section
 * they're in.
 */
type WalkContext = {
  path: string;
  sectionTitle: string | null;
};

const ROOT_CTX: WalkContext = { path: "doc", sectionTitle: null };

export function validateProposalDoc(doc: unknown): ValidationResult {
  if (!isObject(doc)) return fail("Expected a ProseMirror document object.");
  const root = doc as ProseMirrorDoc;
  if (root.type !== "doc") return fail("Root node must have type 'doc'.");
  return validateNode(root, true, ROOT_CTX);
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
  const ctx: WalkContext = {
    path: `section "${collectText(heading) || "untitled"}"`,
    sectionTitle: collectText(heading) || null,
  };
  return validateNode(heading, false, ctx);
}

function validateNode(
  node: ProseMirrorNode,
  isRoot: boolean,
  ctx: WalkContext,
): ValidationResult {
  if (!isObject(node)) return fail(`Encountered a non-object node at ${ctx.path}.`);

  for (const key of Object.keys(node)) {
    if (!ALLOWED_NODE_KEYS.has(key)) {
      return fail(`Unexpected key '${key}' on node at ${ctx.path}.`);
    }
  }

  if (typeof node.type !== "string") {
    return fail(`Each node must have a type (at ${ctx.path}).`);
  }

  if (!ALLOWED_NODES.has(node.type)) {
    return fail(`Node type '${node.type}' is not allowed (at ${ctx.path}).`);
  }

  // Update the walk context as we descend so error messages downstream
  // can pinpoint which section the contributor needs to inspect.
  let nextCtx = ctx;
  if (node.type === "heading" && Number(node.attrs?.level) === 2) {
    const title = collectText(node).trim() || "untitled";
    nextCtx = { path: `section "${title}"`, sectionTitle: title };
  } else if (node.type !== "text") {
    nextCtx = { ...ctx, path: `${ctx.path} > ${node.type}` };
  }

  if (node.type === "heading") {
    const level = Number(node.attrs?.level);
    if (isRoot ? !ALLOWED_HEADING_LEVELS.has(level) : !SECTION_HEADING_LEVELS.has(level)) {
      return fail(`Heading nodes must be level 2 or 3 (at ${ctx.path}).`);
    }
    if (node.attrs && "official" in node.attrs) {
      return fail(
        `Contributors cannot toggle attrs.official on a section heading (at ${ctx.path}).`,
      );
    }
  }

  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "");
    if (!ALLOWED_IMAGE_SRC.test(src)) {
      return fail(
        `Image src '${truncate(src, 80)}' must be a Supabase Storage URL or relative path (at ${ctx.path}).`,
      );
    }
  }

  if (node.type === "citation") {
    const refId = Number(node.attrs?.refId);
    if (!Number.isInteger(refId) || refId < 1) {
      return fail(
        `Citation node must have attrs.refId (positive integer); got '${node.attrs?.refId}' (at ${ctx.path}).`,
      );
    }
    if (node.content && node.content.length > 0) {
      return fail(`Citation node must be a leaf (no content) (at ${ctx.path}).`);
    }
  }

  if (node.marks) {
    if (!Array.isArray(node.marks)) {
      return fail(`marks must be an array (at ${ctx.path}).`);
    }
    for (const mark of node.marks) {
      const linkedText = node.type === "text" ? (node.text ?? "") : "";
      const result = validateMark(mark, nextCtx, linkedText);
      if (!result.ok) return result;
    }
  }

  if (node.content) {
    if (!Array.isArray(node.content)) {
      return fail(`content must be an array (at ${ctx.path}).`);
    }
    for (const child of node.content) {
      const result = validateNode(child as ProseMirrorNode, false, nextCtx);
      if (!result.ok) return result;
    }
  }

  if (node.type === "text" && node.text !== undefined && typeof node.text !== "string") {
    return fail(`text node text must be a string (at ${ctx.path}).`);
  }

  return { ok: true };
}

function validateMark(
  mark: unknown,
  ctx: WalkContext,
  linkedText: string,
): ValidationResult {
  if (!isObject(mark)) return fail(`Mark must be an object (at ${ctx.path}).`);
  for (const key of Object.keys(mark)) {
    if (!ALLOWED_MARK_KEYS.has(key)) {
      return fail(`Unexpected key '${key}' on mark (at ${ctx.path}).`);
    }
  }
  const m = mark as { type: string; attrs?: Record<string, unknown> };
  if (typeof m.type !== "string") return fail(`Mark must have a type (at ${ctx.path}).`);
  if (!ALLOWED_MARKS.has(m.type)) {
    return fail(`Mark '${m.type}' is not allowed (at ${ctx.path}).`);
  }
  if (m.type === "link") {
    if (!m.attrs || typeof m.attrs.href !== "string") {
      return fail(`Link mark requires attrs.href (at ${ctx.path}).`);
    }
    for (const key of Object.keys(m.attrs)) {
      if (!ALLOWED_LINK_ATTR_KEYS.has(key)) {
        return fail(`Unexpected key '${key}' on link mark (at ${ctx.path}).`);
      }
    }
    if (!ALLOWED_LINK_HREF.test(m.attrs.href)) {
      const snippet = linkedText ? ` Linked text: "${truncate(linkedText, 60)}".` : "";
      return fail(
        `Link href '${truncate(m.attrs.href, 100)}' must use http(s), mailto:, or be an absolute path (at ${ctx.path}).${snippet}`,
      );
    }
  }
  return { ok: true };
}

/** Recursively flatten text content for use in error breadcrumbs. */
function collectText(node: ProseMirrorNode | ProseMirrorDoc): string {
  if ("type" in node && node.type === "text") return node.text ?? "";
  const children = (node as ProseMirrorNode).content;
  if (!children) return "";
  return children.map(collectText).join("");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fail(error: string): ValidationFail {
  return { ok: false, error };
}
