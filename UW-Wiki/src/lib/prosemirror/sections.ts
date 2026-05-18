import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";
import { slugify } from "@/lib/utils/slug";

export type Section = {
  /** Stable slug from `attrs.slug` if present; otherwise computed. */
  slug: string;
  /** Display heading text. */
  title: string;
  /** Raw heading node, including attrs. */
  heading: ProseMirrorNode;
  /** Body nodes between this H2 and the next H2 (excludes the heading). */
  body: ProseMirrorNode[];
  /** Position of the heading inside doc.content (zero-based). */
  startIndex: number;
  /** Index AFTER the last body node (exclusive). */
  endIndex: number;
};

/**
 * Extract H2 sections from a ProseMirror doc. Nodes before the first H2 are
 * collapsed into a synthetic "overview" section so empty docs still produce
 * one section the editor/diff engine can target.
 */
export function extractSections(doc: ProseMirrorDoc): Section[] {
  const content = doc.content ?? [];
  const sections: Section[] = [];
  const seen = new Set<string>();
  let pending: Section | null = null;

  function pushPending() {
    if (!pending) return;
    pending.endIndex = pending.endIndex || pending.startIndex + 1;
    sections.push(pending);
    pending = null;
  }

  function uniqueSlug(base: string): string {
    let slug = base || "section";
    let i = 2;
    while (seen.has(slug)) slug = `${base}-${i++}`;
    seen.add(slug);
    return slug;
  }

  for (let index = 0; index < content.length; index += 1) {
    const node = content[index];
    if (isH2(node)) {
      pushPending();
      const title = collectText(node).trim() || "Untitled Section";
      const slugAttr =
        typeof node.attrs?.slug === "string" && node.attrs.slug
          ? (node.attrs.slug as string)
          : null;
      const slug = uniqueSlug(slugAttr ?? slugify(title));
      pending = {
        slug,
        title,
        heading: node,
        body: [],
        startIndex: index,
        endIndex: index + 1,
      };
      continue;
    }

    if (!pending) {
      // Implicit overview wrapper for content above the first H2.
      const slug = uniqueSlug("overview");
      pending = {
        slug,
        title: "Overview",
        heading: {
          type: "heading",
          attrs: { level: 2, slug },
          content: [{ type: "text", text: "Overview" }],
        },
        body: [],
        startIndex: index,
        endIndex: index,
      };
    }

    pending.body.push(node);
    pending.endIndex = index + 1;
  }

  pushPending();
  return sections;
}

export function findSectionBySlug(
  doc: ProseMirrorDoc,
  slug: string,
): Section | null {
  return extractSections(doc).find((section) => section.slug === slug) ?? null;
}

export function sectionToProseMirrorDoc(section: Section): ProseMirrorDoc {
  return {
    type: "doc",
    content: [section.heading, ...section.body],
  };
}

export function replaceSection(
  doc: ProseMirrorDoc,
  section: Section,
  replacementHeading: ProseMirrorNode,
  replacementBody: ProseMirrorNode[],
): ProseMirrorDoc {
  const before = (doc.content ?? []).slice(0, section.startIndex);
  const after = (doc.content ?? []).slice(section.endIndex);
  return {
    type: "doc",
    content: [...before, replacementHeading, ...replacementBody, ...after],
  };
}

/**
 * Append a section (heading + body) to the end of `doc.content`. Used by
 * the proposal-accept path when a contributor introduces a section that
 * doesn't exist on the live page yet — `replaceSection` only handles the
 * replace-in-place case, so without this helper the accept path would
 * throw on any pure addition.
 */
export function appendSection(
  doc: ProseMirrorDoc,
  heading: ProseMirrorNode,
  body: ProseMirrorNode[],
): ProseMirrorDoc {
  return {
    type: "doc",
    content: [...(doc.content ?? []), heading, ...body],
  };
}

/**
 * Drop a section (heading + body) from `doc.content`. Used by the
 * proposal-accept path when a contributor deletes a section in the
 * editor — `replaceSection` requires a replacement body, which is the
 * wrong primitive for "remove this entirely".
 */
export function removeSection(
  doc: ProseMirrorDoc,
  section: Section,
): ProseMirrorDoc {
  const before = (doc.content ?? []).slice(0, section.startIndex);
  const after = (doc.content ?? []).slice(section.endIndex);
  return { type: "doc", content: [...before, ...after] };
}

export function ensureSectionSlugs(doc: ProseMirrorDoc): ProseMirrorDoc {
  const seen = new Set<string>();
  const content = (doc.content ?? []).map((node) => {
    if (!isH2(node)) return node;
    const title = collectText(node).trim() || "Untitled Section";
    const base =
      typeof node.attrs?.slug === "string" && node.attrs.slug
        ? (node.attrs.slug as string)
        : slugify(title);
    let slug = base || "section";
    let i = 2;
    while (seen.has(slug)) slug = `${base}-${i++}`;
    seen.add(slug);
    return {
      ...node,
      attrs: { ...(node.attrs ?? {}), slug, level: 2 },
    };
  });
  return { type: "doc", content };
}

export function extractPlainText(doc: ProseMirrorDoc | ProseMirrorNode): string {
  return collectText(doc);
}

export function preserveOfficialAttributes(
  current: Section,
  proposedHeading: ProseMirrorNode,
): ProseMirrorNode {
  const officialFromCurrent =
    typeof current.heading.attrs?.official === "boolean"
      ? (current.heading.attrs.official as boolean)
      : false;
  return {
    ...proposedHeading,
    attrs: {
      ...(proposedHeading.attrs ?? {}),
      level: 2,
      slug: current.slug,
      official: officialFromCurrent,
    },
  };
}

function isH2(node: ProseMirrorNode): boolean {
  return (
    node.type === "heading" &&
    typeof node.attrs?.level === "number" &&
    node.attrs.level === 2
  );
}

function collectText(node: ProseMirrorNode | ProseMirrorDoc): string {
  if ("type" in node && node.type === "text") return node.text ?? "";
  const children = (node as ProseMirrorNode).content;
  if (!children) return "";
  return children.map(collectText).join("");
}
