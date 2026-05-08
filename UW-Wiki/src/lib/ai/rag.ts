import { tool } from "ai";
import { z } from "zod";

import { embedText, toPgVector } from "@/lib/ai/embeddings";
import { supabaseRest } from "@/lib/supabase/rest";
import type { ChunkResult, ChunkType, FallbackPage } from "@/types/domain";

const RRF_K = 60;
const SIMILARITY_THRESHOLD = 0.35;
const TOP_K_PER_SEARCH = 20;
const TOP_K_RESULTS = 8;

type SemanticRpcRow = {
  id: string;
  content_text: string;
  org_name: string;
  org_slug: string;
  section_title: string | null;
  section_slug: string | null;
  chunk_type: ChunkType;
  category: string;
  anchored_section: string | null;
  references_previous_version: boolean;
  created_at: string;
  similarity_score: number;
};

type KeywordRpcRow = Omit<SemanticRpcRow, "similarity_score"> & {
  rank_score: number;
};

type RankedResult = ChunkResult & {
  rankSource: "semantic" | "keyword";
};

export async function hybridSearch(
  query: string,
  universityId?: string,
): Promise<{ results: ChunkResult[]; fallbackPages: FallbackPage[] }> {
  const queryVector = await embedText(query);

  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(queryVector, universityId),
    keywordSearch(query, universityId),
  ]);

  const merged = mergeWithRRF(semanticResults, keywordResults);
  const aboveThreshold = merged.filter(
    (result) => result.similarityScore >= SIMILARITY_THRESHOLD,
  );
  const belowThreshold = merged.filter(
    (result) => result.similarityScore < SIMILARITY_THRESHOLD,
  );

  return {
    results: aboveThreshold.slice(0, TOP_K_RESULTS),
    fallbackPages: uniqueFallbackPages(belowThreshold).slice(0, 5),
  };
}

export const searchWikiTool = tool({
  description:
    "Search the UW Wiki knowledge base for information about UW clubs, design teams, academic programs, and student organizations. Returns relevant wiki page sections and user comments with source attribution.",
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .describe("Natural language search query describing what information you need"),
    filters: z
      .object({
        universityId: z.string().uuid().optional(),
      })
      .optional()
      .describe("Optional filters to narrow search scope"),
  }),
  execute: async ({ query, filters }) => {
    const { results, fallbackPages } = await hybridSearch(
      query,
      filters?.universityId,
    );

    if (results.length === 0) {
      return {
        found: false,
        suggestedPages: fallbackPages,
        message: "No relevant content found above the relevance threshold.",
      };
    }

    return {
      found: true,
      chunks: results.map((result, index) => ({
        citationIndex: index + 1,
        content: result.content,
        orgName: result.orgName,
        orgSlug: result.orgSlug,
        sectionTitle: result.sectionTitle,
        sectionSlug: result.sectionSlug,
        chunkType: result.chunkType,
        category: result.category,
        anchoredSection: result.anchoredSection,
        referencesPreviousVersion: result.referencesPreviousVersion,
        createdAt: result.createdAt,
        sourceUrl: result.sectionSlug
          ? `/wiki/${result.orgSlug}#${result.sectionSlug}`
          : `/wiki/${result.orgSlug}`,
      })),
    };
  },
});

async function semanticSearch(
  queryVector: number[],
  universityId?: string,
): Promise<RankedResult[]> {
  const rows = await supabaseRest<SemanticRpcRow[]>("/rpc/match_chunks_semantic", {
    method: "POST",
    body: JSON.stringify({
      query_embedding: toPgVector(queryVector),
      match_count: TOP_K_PER_SEARCH,
      university_filter: universityId ?? null,
    }),
  });

  return rows.map((row) => ({
    ...mapChunkRow(row),
    similarityScore: row.similarity_score,
    rrfScore: 0,
    rankSource: "semantic",
  }));
}

async function keywordSearch(
  query: string,
  universityId?: string,
): Promise<RankedResult[]> {
  const rows = await supabaseRest<KeywordRpcRow[]>("/rpc/match_chunks_keyword", {
    method: "POST",
    body: JSON.stringify({
      query_text: query,
      match_count: TOP_K_PER_SEARCH,
      university_filter: universityId ?? null,
    }),
  });

  return rows.map((row) => ({
    ...mapChunkRow(row),
    // Exact keyword-only hits are still valuable; treat them as threshold-passing
    // unless a semantic result later replaces this with an actual cosine score.
    similarityScore: SIMILARITY_THRESHOLD,
    rrfScore: 0,
    rankSource: "keyword",
  }));
}

function mergeWithRRF(
  semanticResults: RankedResult[],
  keywordResults: RankedResult[],
): ChunkResult[] {
  const scoreMap = new Map<string, ChunkResult>();

  for (const [rank, result] of semanticResults.entries()) {
    const existing = scoreMap.get(result.id);
    const rrfContribution = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfContribution;
      existing.similarityScore = Math.max(
        existing.similarityScore,
        result.similarityScore,
      );
    } else {
      scoreMap.set(result.id, {
        ...result,
        rrfScore: rrfContribution,
      });
    }
  }

  for (const [rank, result] of keywordResults.entries()) {
    const existing = scoreMap.get(result.id);
    const rrfContribution = 1 / (RRF_K + rank + 1);
    if (existing) {
      existing.rrfScore += rrfContribution;
    } else {
      scoreMap.set(result.id, {
        ...result,
        rrfScore: rrfContribution,
      });
    }
  }

  return [...scoreMap.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

function mapChunkRow(row: SemanticRpcRow | KeywordRpcRow): Omit<
  ChunkResult,
  "similarityScore" | "rrfScore"
> {
  return {
    id: row.id,
    content: row.content_text,
    orgName: row.org_name,
    orgSlug: row.org_slug,
    sectionTitle: row.section_title,
    sectionSlug: row.section_slug,
    chunkType: row.chunk_type,
    category: row.category,
    anchoredSection: row.anchored_section,
    referencesPreviousVersion: row.references_previous_version,
    createdAt: row.created_at,
  };
}

function uniqueFallbackPages(results: ChunkResult[]): FallbackPage[] {
  return [
    ...new Map(
      results.map((result) => [
        result.orgSlug,
        { orgName: result.orgName, orgSlug: result.orgSlug },
      ]),
    ).values(),
  ];
}
