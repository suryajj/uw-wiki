import { eq, requireEnv, supabaseRest } from "./lib/env.mjs";

const env = requireEnv(
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_HTTP_REFERER",
  "OPENROUTER_X_TITLE",
);

const [org] = await supabaseRest(
  "/organizations?select=id,university_id,org_slug,org_name,category&org_slug=eq.watonomous&limit=1",
);

if (!org) {
  console.error("Missing seeded WATonomous org.");
  process.exit(1);
}

const [page] = await supabaseRest(
  `/pages?select=id,content_json,current_version_id&org_id=${eq(org.id)}&limit=1`,
);

if (!page) {
  console.error("Missing seeded WATonomous page.");
  process.exit(1);
}

const chunks = chunkDoc(page.content_json, org.org_name);
if (chunks.length === 0) {
  console.error("No chunks produced from seeded page.");
  process.exit(1);
}

const vectors = await embed(chunks.map((chunk) => chunk.content));

await supabaseRest(`/chunks?page_id=${eq(page.id)}&chunk_type=eq.content`, {
  method: "DELETE",
});

await supabaseRest("/chunks", {
  method: "POST",
  prefer: "return=minimal",
  body: JSON.stringify(
    chunks.map((chunk, index) => ({
      university_id: org.university_id,
      org_id: org.id,
      page_id: page.id,
      page_version_id: page.current_version_id,
      chunk_type: "content",
      org_name: org.org_name,
      org_slug: org.org_slug,
      category: org.category,
      section_title: chunk.sectionTitle,
      section_slug: chunk.sectionSlug,
      chunk_index: index,
      content_text: chunk.content,
      embedding: `[${vectors[index].join(",")}]`,
    })),
  ),
});

const inserted = await supabaseRest(
  `/chunks?select=id,content_text,section_slug&page_id=${eq(page.id)}&chunk_type=eq.content`,
);

console.log(`✓ Ingested ${inserted.length} content chunk(s) for WATonomous`);
console.log(`  First chunk: ${inserted[0]?.section_slug ?? "(none)"}`);

function chunkDoc(doc, orgName) {
  const output = [];
  let title = "Overview";
  let slug = "overview";
  let body = [];

  for (const node of doc.content ?? []) {
    if (node.type === "heading") {
      flush();
      title = textOf(node).trim() || "Untitled Section";
      slug =
        typeof node.attrs?.slug === "string" && node.attrs.slug
          ? node.attrs.slug
          : slugify(title);
      body = [];
    } else {
      body.push(textOf(node));
    }
  }
  flush();
  return output;

  function flush() {
    const content = body.join("\n").trim();
    if (!content) return;
    output.push({
      sectionTitle: title,
      sectionSlug: slug,
      content: `[${orgName} > ${title}]\n${content}`,
    });
  }
}

function textOf(node) {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textOf).join(" ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function embed(texts) {
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
      input: texts,
      dimensions: 512,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Embedding failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body.data.map((item) => item.embedding);
}
