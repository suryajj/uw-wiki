import "server-only";

import { extractPlainText, extractSections } from "@/lib/prosemirror/sections";
import type { ProseMirrorDoc, SectionSlug } from "@/types/domain";

/**
 * Construct a SectionSlug from a raw string. Rejects empty and "unknown".
 * Callers must handle null and pick an explicit fallback.
 */
export function asSectionSlug(s: string | null | undefined): SectionSlug | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed || trimmed === "unknown") return null;
  return trimmed as SectionSlug;
}

/**
 * Derive the section slug for a comment from the anchor text + page doc.
 * Falls back to the first section (always present — `extractSections`
 * synthesizes an "overview" if no H2s exist) when the anchor can't be located.
 */
export function deriveSectionSlug(
  anchorText: string,
  doc: ProseMirrorDoc,
): SectionSlug {
  const sections = extractSections(doc);
  const firstSlug = (sections[0]?.slug ?? "overview") as SectionSlug;

  const cleaned = anchorText.replace(/\s+/g, " ").trim();
  if (!cleaned) return firstSlug;

  for (const section of sections) {
    const sectionText = extractPlainText({
      type: "doc",
      content: [section.heading, ...section.body],
    })
      .replace(/\s+/g, " ")
      .trim();
    if (sectionText.includes(cleaned)) return section.slug as SectionSlug;
  }

  return firstSlug;
}
