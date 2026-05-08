import { supabaseRest } from "./lib/env.mjs";

const [watonomous] = await supabaseRest(
  "/organizations?select=org_slug,org_name,category,pages(last_modified_at),pulse_aggregates(metric,aggregate_value,aggregate_label,total_votes)&org_slug=eq.watonomous&limit=1",
);

if (!watonomous) {
  console.error("get_org_data smoke failed: WATonomous not found.");
  process.exit(1);
}

const pulse = Object.fromEntries(
  (watonomous.pulse_aggregates ?? []).map((row) => [row.metric, row]),
);

if (!pulse.selectivity || !pulse.coop_boost || !pulse.tech_stack) {
  console.error("get_org_data smoke failed: missing Pulse aggregates.", pulse);
  process.exit(1);
}

if (!watonomous.pages?.last_modified_at) {
  console.error("get_org_data smoke failed: missing page last_modified_at.", watonomous);
  process.exit(1);
}

const ranked = await supabaseRest(
  "/pulse_aggregates?select=aggregate_value,total_votes,aggregate_label,organizations!inner(org_name,org_slug,category)&metric=eq.coop_boost&total_votes=gte.3&order=aggregate_value.desc&limit=3",
);

if (!ranked.some((row) => row.organizations?.org_slug === "watonomous")) {
  console.error("list_orgs smoke failed: WATonomous not in coop_boost ranking.", ranked);
  process.exit(1);
}

console.log("✓ get_org_data smoke: WATonomous Pulse data present");
console.log("✓ list_orgs smoke: coop_boost ranking returns WATonomous");
