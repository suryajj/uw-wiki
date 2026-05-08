import type { ProseMirrorDoc } from "@/types/domain";
import { extractPlainText } from "@/lib/prosemirror/sections";

export type AnchorResult =
  | { isAnchored: false }
  | { isAnchored: true; start: number; end: number };

export function pageTextFromDoc(doc: ProseMirrorDoc): string {
  return extractPlainText(doc).replace(/\s+/g, " ").trim();
}

export function reanchor(anchorText: string, pageText: string): AnchorResult {
  if (!anchorText) return { isAnchored: false };
  const needle = anchorText.replace(/\s+/g, " ").trim();
  if (!needle) return { isAnchored: false };
  const index = pageText.indexOf(needle);
  if (index === -1) return { isAnchored: false };
  return { isAnchored: true, start: index, end: index + needle.length };
}

export function truncateAnchor(text: string, max = 500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
