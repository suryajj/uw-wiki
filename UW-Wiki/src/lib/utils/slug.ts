/**
 * Stable slug generator shared by ProseMirror section extraction, RAG
 * chunking, and seed migrations. Lives outside `embeddings.ts` so we can
 * use it from both modules without creating an import cycle.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
