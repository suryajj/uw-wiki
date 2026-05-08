import { eq, supabaseRest } from "./lib/env.mjs";

const failures = [];
function assert(label, condition, detail = "") {
  if (condition) console.log(`✓ ${label}`);
  else failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

const tables = [
  "cold_start_jobs",
  "admin_activity_log",
  "proposal_review_comments",
];
for (const table of tables) {
  const rows = await supabaseRest(`/${table}?select=id&limit=1`).catch((error) => ({ error }));
  assert(`${table} exists`, Array.isArray(rows), rows.error?.message);
}

const usersCols = await supabaseRest("/users?select=id,email_verified_at&limit=1").catch((error) => ({ error }));
assert("users.email_verified_at exists", Array.isArray(usersCols), usersCols.error?.message);

const [org] = await supabaseRest("/organizations?select=id,org_name&org_slug=eq.watonomous&limit=1");
const [page] = await supabaseRest("/pages?select=id&org_id=" + eq(org.id) + "&limit=1");

const [job] = await supabaseRest("/cold_start_jobs?select=id", {
  method: "POST",
  prefer: "return=representation",
  body: JSON.stringify({
    input_text: `Smoke Job ${Date.now()}`,
    input_type: "name",
    status: "awaiting_confirmation",
    org_metadata: { name: "Smoke Org", category: "Design Teams" },
  }),
});
assert("can create cold_start_jobs row via service role", !!job?.id);
await supabaseRest(`/cold_start_jobs?id=${eq(job.id)}`, { method: "DELETE" });

assert("seed org/page still present", !!org?.id && !!page?.id);

if (failures.length) {
  console.error("FRD-5/6/7 smoke failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("All FRD-5/6/7 schema smoke checks passed.");
