// Stub. Real `search_wiki` implementation and hybrid retrieval lands in FRD-1.
import { tool } from "ai";
import { z } from "zod";

export const searchWikiTool = tool({
  description:
    "Search the UW Wiki knowledge base. (Stub — real retrieval lands in FRD-1.)",
  inputSchema: z.object({
    query: z.string().describe("Natural language search query"),
  }),
  execute: async ({ query: _query }) => {
    return {
      found: false,
      message: "Stub: real search lands in FRD-1.",
    };
  },
});
