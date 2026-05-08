import { env } from "@/lib/config/env";
import { eq, inList, supabaseRest } from "@/lib/supabase/rest";
import type {
  CommentData,
  OrgMeta,
  ProseMirrorDoc,
  ProseMirrorNode,
} from "@/types/domain";

export type { CommentData, OrgMeta, ProseMirrorDoc };

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 512;
const MAX_TEXTS_PER_BATCH = 100;
const MAX_TOKENS_PER_BATCH = 8_000;
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export const CHUNKING_CONFIG = {
  MAX_TOKENS: 1000,
  OVERLAP_TOKENS: 100,
  CHARS_PER_TOKEN: 4,
} as const;

type EmbeddedChunk = {
  sectionTitle: string;
  sectionSlug: string;
  chunkIndex: number;
  contentWithHeader: string;
};

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  error?: { message?: string };
};

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  if (!vector) throw new Error("OpenRouter returned no embedding vector.");
  return vector;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const vectors: number[][] = [];
  for (const batch of createEmbeddingBatches(texts)) {
    console.info(`[rag] embedding ${batch.length} text(s)`);
    vectors.push(...(await embedBatchOnceWithRetry(batch)));
  }
  return vectors;
}

export function chunkProseMirrorDoc(
  doc: ProseMirrorDoc,
  orgMeta: OrgMeta,
): EmbeddedChunk[] {
  const sections = extractSections(doc);
  const chunks: EmbeddedChunk[] = [];

  for (const section of sections) {
    const sectionSlug = slugify(section.title);
    const parts = splitLongText(section.body);

    for (const [partIndex, part] of parts.entries()) {
      const partSuffix = parts.length > 1 ? ` [Part ${partIndex + 1}/${parts.length}]` : "";
      const header = `[${orgMeta.orgName} > ${section.title}${partSuffix}]`;
      chunks.push({
        sectionTitle: section.title,
        sectionSlug,
        chunkIndex: partIndex,
        contentWithHeader: `${header}\n${part}`,
      });
    }
  }

  return chunks;
}

export async function reembedPage(
  pageId: string,
  orgMeta: OrgMeta,
  content: ProseMirrorDoc,
): Promise<void> {
  await supabaseRest(
    `/chunks?page_id=${eq(pageId)}&chunk_type=${eq("content")}`,
    { method: "DELETE" },
  );

  const chunks = chunkProseMirrorDoc(content, orgMeta);
  if (chunks.length === 0) return;

  const vectors = await embedBatch(chunks.map((chunk) => chunk.contentWithHeader));
  await supabaseRest<void>(
    "/chunks",
    {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify(
    chunks.map((chunk, i) => ({
      university_id: orgMeta.universityId,
      org_id: orgMeta.orgId,
      page_id: pageId,
      page_version_id: orgMeta.pageVersionId ?? null,
      chunk_type: "content",
      org_name: orgMeta.orgName,
      org_slug: orgMeta.orgSlug,
      category: orgMeta.category,
      section_title: chunk.sectionTitle,
      section_slug: chunk.sectionSlug,
      chunk_index: chunk.chunkIndex,
      content_text: chunk.contentWithHeader,
      embedding: toPgVector(vectors[i] ?? []),
    })),
      ),
    },
  );
}

export async function reembedSections(
  pageId: string,
  sectionSlugs: string[],
  orgMeta: OrgMeta,
  content: ProseMirrorDoc,
): Promise<void> {
  if (sectionSlugs.length === 0) return;

  await supabaseRest(
    `/chunks?page_id=${eq(pageId)}&chunk_type=${eq("content")}&section_slug=${inList(sectionSlugs)}`,
    { method: "DELETE" },
  );

  const chunks = chunkProseMirrorDoc(content, orgMeta).filter((chunk) =>
    sectionSlugs.includes(chunk.sectionSlug),
  );
  if (chunks.length === 0) return;

  const vectors = await embedBatch(chunks.map((chunk) => chunk.contentWithHeader));
  await supabaseRest<void>(
    "/chunks",
    {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify(
    chunks.map((chunk, i) => ({
      university_id: orgMeta.universityId,
      org_id: orgMeta.orgId,
      page_id: pageId,
      page_version_id: orgMeta.pageVersionId ?? null,
      chunk_type: "content",
      org_name: orgMeta.orgName,
      org_slug: orgMeta.orgSlug,
      category: orgMeta.category,
      section_title: chunk.sectionTitle,
      section_slug: chunk.sectionSlug,
      chunk_index: chunk.chunkIndex,
      content_text: chunk.contentWithHeader,
      embedding: toPgVector(vectors[i] ?? []),
    })),
      ),
    },
  );
}

export async function reembedComment(
  commentId: string,
  orgMeta: OrgMeta,
  comment: CommentData,
): Promise<void> {
  await supabaseRest(
    `/chunks?source_comment_id=${eq(commentId)}`,
    { method: "DELETE" },
  );

  const header = comment.anchoredSection
    ? `[${orgMeta.orgName} > ${comment.anchoredSection} > Comment]`
    : `[${orgMeta.orgName} > Comment]`;
  const contentWithHeader = `${header}\n${comment.body}`;
  const vector = await embedText(contentWithHeader);

  await supabaseRest<void>("/chunks", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      university_id: orgMeta.universityId,
      org_id: orgMeta.orgId,
      source_comment_id: commentId,
      chunk_type: "comment",
      org_name: orgMeta.orgName,
      org_slug: orgMeta.orgSlug,
      category: orgMeta.category,
      anchored_section: comment.anchoredSection,
      references_previous_version: comment.referencesPreviousVersion ?? false,
      content_text: contentWithHeader,
      embedding: toPgVector(vector),
      created_at: comment.createdAt,
    }),
  });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHUNKING_CONFIG.CHARS_PER_TOKEN);
}

function createEmbeddingBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokenCount = estimateTokens(text);
    const wouldExceedCount = current.length >= MAX_TEXTS_PER_BATCH;
    const wouldExceedTokens =
      current.length > 0 && currentTokens + tokenCount > MAX_TOKENS_PER_BATCH;

    if (wouldExceedCount || wouldExceedTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(text);
    currentTokens += tokenCount;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

async function embedBatchOnceWithRetry(texts: string[]): Promise<number[][]> {
  try {
    return await embedBatchOnce(texts);
  } catch (error) {
    if (!isTransientEmbeddingError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return embedBatchOnce(texts);
  }
}

async function embedBatchOnce(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.OPENROUTER_HTTP_REFERER,
      "X-Title": env.OPENROUTER_X_TITLE,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as EmbeddingResponse;
  if (!response.ok) {
    throw new EmbeddingHttpError(
      response.status,
      body.error?.message ?? `OpenRouter embedding request failed with ${response.status}`,
    );
  }

  const vectors = [...(body.data ?? [])]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding);

  if (vectors.length !== texts.length || vectors.some((vector) => !vector)) {
    throw new Error("OpenRouter embedding response did not match input length.");
  }

  return vectors.map((vector) => {
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dimension embedding.`);
    }
    return vector;
  });
}

class EmbeddingHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EmbeddingHttpError";
  }
}

function isTransientEmbeddingError(error: unknown): boolean {
  return (
    error instanceof EmbeddingHttpError &&
    TRANSIENT_STATUS_CODES.has(error.status)
  );
}

function extractSections(doc: ProseMirrorDoc): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; nodes: ProseMirrorNode[] }> = [];
  let current: { title: string; nodes: ProseMirrorNode[] } | null = null;

  for (const node of doc.content ?? []) {
    if (node.type === "heading" && typeof node.attrs?.level === "number") {
      if (current) sections.push(current);
      current = {
        title: extractText(node).trim() || "Untitled Section",
        nodes: [],
      };
      continue;
    }

    if (!current) {
      current = { title: "Overview", nodes: [] };
    }
    current.nodes.push(node);
  }

  if (current) sections.push(current);

  return sections
    .map((section) => ({
      title: section.title,
      body: section.nodes.map(extractText).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    }))
    .filter((section) => section.body.length > 0);
}

function extractText(node: ProseMirrorNode): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content || node.content.length === 0) return "";
  const separator = blockNodeTypes.has(node.type) ? "\n" : "";
  return node.content.map(extractText).join(separator);
}

const blockNodeTypes = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "table",
  "tableRow",
]);

function splitLongText(text: string): string[] {
  if (estimateTokens(text) <= CHUNKING_CONFIG.MAX_TOKENS) return [text];

  const maxChars = CHUNKING_CONFIG.MAX_TOKENS * CHUNKING_CONFIG.CHARS_PER_TOKEN;
  const overlapChars =
    CHUNKING_CONFIG.OVERLAP_TOKENS * CHUNKING_CONFIG.CHARS_PER_TOKEN;
  const sentences = text.match(/[^.!?]+[.!?]+|\S[\s\S]*$/g) ?? [text];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.trim()) {
      parts.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlapChars));
    }
    current += sentence;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
