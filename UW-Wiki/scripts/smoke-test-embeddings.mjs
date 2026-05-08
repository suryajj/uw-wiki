import { requireEnv } from "./lib/env.mjs";

const env = requireEnv(
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_HTTP_REFERER",
  "OPENROUTER_X_TITLE",
);

const inputs = Array.from({ length: 10 }, (_, i) => `test embedding ${i + 1}`);

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
    input: inputs,
    dimensions: 512,
  }),
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error("Embedding request failed:", response.status, body);
  process.exit(1);
}

const vectors = body.data?.map((item) => item.embedding) ?? [];
if (vectors.length !== inputs.length) {
  console.error("Expected 10 embeddings, got:", vectors.length);
  process.exit(1);
}

if (vectors.some((vector) => !Array.isArray(vector) || vector.length !== 512)) {
  console.error("Expected every embedding to have 512 dimensions.");
  process.exit(1);
}

console.log("✓ Embedding service returned 10 vectors with 512 dimensions each");
