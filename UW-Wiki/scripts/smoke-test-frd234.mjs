import { eq, supabaseRest } from "./lib/env.mjs";

const pages = await supabaseRest(
  "/pages?select=id,slug,current_version_id,content_json&slug=eq.watonomous&limit=1",
);
if (!pages[0]?.slug || !pages[0]?.current_version_id) {
  console.error("FRD-2 smoke failed: WATonomous page missing slug/current_version_id.", pages);
  process.exit(1);
}

const versions = await supabaseRest(
  `/page_versions?select=id,version_number,summary&page_id=${eq(pages[0].id)}&limit=5`,
);
if (versions.length === 0 || !versions[0].version_number) {
  console.error("FRD-2 smoke failed: version history data missing.", versions);
  process.exit(1);
}

const lifecycle = await supabaseRest(
  "/lifecycle_config?select=category,needs_update_days,stale_days,defunct_days&category=eq.Design%20Teams",
);
if (!lifecycle[0]?.stale_days || !lifecycle[0]?.defunct_days) {
  console.error("FRD-2 smoke failed: lifecycle thresholds missing.", lifecycle);
  process.exit(1);
}

const patchsets = await supabaseRest("/edit_proposal_patchsets?select=id&limit=1");
if (!Array.isArray(patchsets)) {
  console.error("FRD-4 smoke failed: patchset table inaccessible.");
  process.exit(1);
}

const commentVotes = await supabaseRest("/comment_votes?select=comment_id,user_id,vote_type&limit=1");
if (!Array.isArray(commentVotes)) {
  console.error("FRD-3 smoke failed: comment_votes table inaccessible.");
  process.exit(1);
}

console.log("✓ FRD-2/3/4 schema and seed smoke checks passed");
