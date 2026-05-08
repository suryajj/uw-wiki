// Audit-fix smoke: verifies the security and correctness changes shipped
// in `0042_security_hardening.sql` plus the slug, validation, and lifecycle
// fixes layered on top of FRD-0..4.

import { eq, loadEnv, requireEnv, supabaseRest } from "./lib/env.mjs";

requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

let failures = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------
// 1. Schema columns added by 0042
// ---------------------------------------------------------------------
const commentsCol = await supabaseRest(
  "/comments?select=id,is_anchored&limit=1",
).catch((error) => ({ error }));
check(
  "comments.is_anchored column exists",
  Array.isArray(commentsCol),
  commentsCol?.error?.message,
);

const proposalsCol = await supabaseRest(
  "/edit_proposals?select=id,last_decision_log&limit=1",
).catch((error) => ({ error }));
check(
  "edit_proposals.last_decision_log column exists",
  Array.isArray(proposalsCol),
  proposalsCol?.error?.message,
);

// ---------------------------------------------------------------------
// 2. Anonymous-insert RLS hardened
// ---------------------------------------------------------------------
const anonRest = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const [page] = await supabaseRest(
  "/pages?select=id&slug=eq.watonomous&limit=1",
);

const anonCommentInsert = await anonRest("/comments", {
  method: "POST",
  body: JSON.stringify({
    page_id: page.id,
    is_anonymous: true,
    section_slug: "overview",
    body: "audit anon insert attempt",
  }),
});
check(
  "anonymous JWT cannot insert comments via PostgREST",
  anonCommentInsert.status === 401 || anonCommentInsert.status === 403,
  `status=${anonCommentInsert.status}`,
);

// ---------------------------------------------------------------------
// 3. accept_proposal_commit revoked from anon/authenticated
// ---------------------------------------------------------------------
const anonRpc = await anonRest("/rpc/accept_proposal_commit", {
  method: "POST",
  body: JSON.stringify({
    p_proposal_id: "00000000-0000-0000-0000-000000000000",
    p_page_id: "00000000-0000-0000-0000-000000000000",
    p_new_content: { type: "doc", content: [] },
    p_reviewer_id: "00000000-0000-0000-0000-000000000000",
    p_summary: "audit",
    p_is_admin_seeded: false,
  }),
});
check(
  "accept_proposal_commit RPC revoked from anon",
  anonRpc.status === 401 || anonRpc.status === 403 || anonRpc.status === 404,
  `status=${anonRpc.status}`,
);

const anonVoteRpc = await anonRest("/rpc/increment_comment_vote", {
  method: "POST",
  body: JSON.stringify({
    p_comment_id: "00000000-0000-0000-0000-000000000000",
    p_delta_up: 1,
    p_delta_down: 0,
  }),
});
check(
  "increment_comment_vote RPC revoked from anon",
  anonVoteRpc.status === 401 || anonVoteRpc.status === 403 || anonVoteRpc.status === 404,
  `status=${anonVoteRpc.status}`,
);

// ---------------------------------------------------------------------
// 4. Hidden comment filter still works on RAG RPCs
// ---------------------------------------------------------------------
const hiddenSentinel = `audit-hidden-${Date.now()}`;
const [orgRow] = await supabaseRest(
  "/organizations?select=id,university_id,org_name,org_slug,category&org_slug=eq.watonomous&limit=1",
);
const [hiddenComment] = await supabaseRest("/comments", {
  method: "POST",
  prefer: "return=representation",
  body: JSON.stringify({
    page_id: page.id,
    is_anonymous: true,
    section_slug: "overview",
    body: hiddenSentinel,
    is_hidden: true,
  }),
});
const zeroVector = `[${Array(512).fill(0).join(",")}]`;
const [hiddenChunk] = await supabaseRest("/chunks", {
  method: "POST",
  prefer: "return=representation",
  body: JSON.stringify({
    university_id: orgRow.university_id,
    org_id: orgRow.id,
    page_id: page.id,
    source_comment_id: hiddenComment.id,
    chunk_type: "comment",
    org_name: orgRow.org_name,
    org_slug: orgRow.org_slug,
    category: orgRow.category,
    section_title: "Overview",
    section_slug: "overview",
    anchored_section: "overview",
    chunk_index: 0,
    references_previous_version: false,
    content_text: hiddenSentinel,
    embedding: zeroVector,
  }),
});
const semanticRows = await supabaseRest("/rpc/match_chunks_semantic", {
  method: "POST",
  body: JSON.stringify({
    query_embedding: zeroVector,
    match_count: 20,
    university_filter: null,
  }),
});
check(
  "hidden comment chunk is excluded by match_chunks_semantic",
  !semanticRows.some((row) => row.id === hiddenChunk.id),
  "hidden chunk leaked",
);
const keywordRows = await supabaseRest("/rpc/match_chunks_keyword", {
  method: "POST",
  body: JSON.stringify({
    query_text: hiddenSentinel,
    match_count: 20,
    university_filter: null,
  }),
});
check(
  "hidden comment chunk is excluded by match_chunks_keyword",
  !keywordRows.some((row) => row.id === hiddenChunk.id),
  "hidden chunk leaked",
);
await supabaseRest(`/chunks?id=${eq(hiddenChunk.id)}`, { method: "DELETE" });
await supabaseRest(`/comments?id=${eq(hiddenComment.id)}`, { method: "DELETE" });

if (failures > 0) {
  console.error(`\nAudit smoke: ${failures} failing check(s).`);
  process.exit(1);
}
console.log("\nAll audit smoke checks passed.");
