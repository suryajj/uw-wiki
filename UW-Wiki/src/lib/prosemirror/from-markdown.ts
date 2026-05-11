import "server-only";

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type {
  Blockquote,
  Heading,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Text as MdastText,
} from "mdast";

import type { ProseMirrorMark, ProseMirrorNode } from "@/types/domain";

/**
 * Convert a markdown string into an array of ProseMirror block nodes
 * conforming to the schema enforced by validateProposalDoc.
 *
 * Supported: paragraph, heading (level 3 only — section h2 is added by caller),
 * bulletList / orderedList / listItem, blockquote, hardBreak.
 * Marks: bold, italic, code, link.
 *
 * Anything unsupported is downgraded to plain text so validation never fails.
 */
export function markdownToProseMirrorNodes(md: string): ProseMirrorNode[] {
  if (!md.trim()) return [];
  const tree = fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const out: ProseMirrorNode[] = [];
  for (const child of tree.children) {
    const node = convertBlock(child);
    if (Array.isArray(node)) out.push(...node);
    else if (node) out.push(node);
  }
  return out;
}

function convertBlock(
  node: RootContent,
): ProseMirrorNode | ProseMirrorNode[] | null {
  switch (node.type) {
    case "paragraph":
      return paragraph((node as Paragraph).children);
    case "heading":
      return heading(node as Heading);
    case "list":
      return list(node as List);
    case "blockquote":
      return blockquote(node as Blockquote);
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "code":
      return {
        type: "codeBlock",
        content: [{ type: "text", text: (node as { value?: string }).value ?? "" }],
      };
    case "html":
      // Strip raw HTML — emit as plain paragraph text
      return paragraph([
        { type: "text", value: (node as { value?: string }).value ?? "" } as MdastText,
      ]);
    default:
      return null;
  }
}

function paragraph(children: PhrasingContent[]): ProseMirrorNode {
  const content = inlineNodes(children);
  return {
    type: "paragraph",
    content: content.length > 0 ? content : [{ type: "text", text: "" }],
  };
}

function heading(node: Heading): ProseMirrorNode {
  // Schema only allows levels 2 and 3 — and section headings (level 2) are
  // emitted by the caller. Always coerce LLM-emitted headings to level 3.
  const content = inlineNodes(node.children);
  return {
    type: "heading",
    attrs: { level: 3 },
    content,
  };
}

function list(node: List): ProseMirrorNode {
  const items: ProseMirrorNode[] = node.children.map((item: ListItem) => {
    const itemContent: ProseMirrorNode[] = [];
    for (const child of item.children) {
      const converted = convertBlock(child);
      if (Array.isArray(converted)) itemContent.push(...converted);
      else if (converted) itemContent.push(converted);
    }
    return {
      type: "listItem",
      content:
        itemContent.length > 0
          ? itemContent
          : [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
    };
  });
  return {
    type: node.ordered ? "orderedList" : "bulletList",
    content: items,
  };
}

function blockquote(node: Blockquote): ProseMirrorNode {
  const inner: ProseMirrorNode[] = [];
  for (const child of node.children) {
    const c = convertBlock(child);
    if (Array.isArray(c)) inner.push(...c);
    else if (c) inner.push(c);
  }
  return { type: "blockquote", content: inner };
}

function inlineNodes(
  children: PhrasingContent[],
  marks: ProseMirrorMark[] = [],
): ProseMirrorNode[] {
  const out: ProseMirrorNode[] = [];
  for (const child of children) {
    switch (child.type) {
      case "text":
        if ((child as MdastText).value) {
          out.push(textNode((child as MdastText).value, marks));
        }
        break;
      case "strong":
        out.push(...inlineNodes(child.children, addMark(marks, { type: "bold" })));
        break;
      case "emphasis":
        out.push(...inlineNodes(child.children, addMark(marks, { type: "italic" })));
        break;
      case "delete":
        out.push(...inlineNodes(child.children, addMark(marks, { type: "strike" })));
        break;
      case "inlineCode":
        out.push(textNode(child.value ?? "", addMark(marks, { type: "code" })));
        break;
      case "link": {
        const linkMark: ProseMirrorMark = {
          type: "link",
          attrs: {
            href: child.url,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
        out.push(...inlineNodes(child.children, addMark(marks, linkMark)));
        break;
      }
      case "break":
        out.push({ type: "hardBreak" });
        break;
      case "image":
        // Drop images — schema requires Supabase storage URL, LLM won't produce one
        if (child.alt) out.push(textNode(child.alt, marks));
        break;
      default:
        // Best-effort: extract any nested phrasing children
        if ("children" in child && Array.isArray((child as { children?: PhrasingContent[] }).children)) {
          out.push(...inlineNodes((child as { children: PhrasingContent[] }).children, marks));
        }
        break;
    }
  }
  return out;
}

function textNode(text: string, marks: ProseMirrorMark[]): ProseMirrorNode {
  const node: ProseMirrorNode = { type: "text", text };
  if (marks.length > 0) node.marks = marks;
  return node;
}

function addMark(
  marks: ProseMirrorMark[],
  mark: ProseMirrorMark,
): ProseMirrorMark[] {
  if (marks.some((m) => m.type === mark.type)) return marks;
  return [...marks, mark];
}
