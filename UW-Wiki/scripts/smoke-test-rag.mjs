import { requireEnv, supabaseRest } from "./lib/env.mjs";

const env = requireEnv(
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_HTTP_REFERER",
  "OPENROUTER_X_TITLE",
);

const query = "ROS2 WATonomous";
const queryVector = await embed(query);

const semantic = await supabaseRest("/rpc/match_chunks_semantic", {
  method: "POST",
  body: JSON.stringify({
    query_embedding: `[${queryVector.join(",")}]`,
    match_count: 5,
    university_filter: null,
  }),
});

const keyword = await supabaseRest("/rpc/match_chunks_keyword", {
  method: "POST",
  body: JSON.stringify({
    query_text: query,
    match_count: 5,
    university_filter: null,
  }),
});

const all = [...semantic, ...keyword];
const hasWatonomous = all.some((row) => row.org_slug === "watonomous");
const hasRos2 = all.some((row) => row.content_text?.toLowerCase().includes("ros2"));

if (!hasWatonomous || !hasRos2) {
  console.error("RAG smoke failed. Results:", all);
  process.exit(1);
}

console.log("✓ RAG RPCs returned relevant WATonomous / ROS2 chunk");
console.log(`  semantic=${semantic.length}, keyword=${keyword.length}`);

async function embed(text) {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.OPENROUTER_HTTP_REFERER,
      "X-Title": env.OPENROUTER_X_TITLE,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: [text],
      dimensions: 512,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Embedding failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body.data[0].embedding;
}
