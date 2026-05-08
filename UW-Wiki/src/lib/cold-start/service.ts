import "server-only";

import { reembedPage } from "@/lib/ai/embeddings";
import { logServerError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import { validateProposalDoc } from "@/lib/prosemirror/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import { SUGGESTED_TEMPLATE } from "@/lib/wiki/template";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { OrgCategory, ProseMirrorDoc } from "@/types/domain";
import type { OrgMetadataInput } from "@/lib/cold-start/schemas";

const WATERLOO_ID = "00000000-0000-0000-0000-000000000001";

const SECTION_TITLES = [
  "Overview",
  "Time Commitment",
  "Culture and Vibe",
  "Subteams and Roles",
  "Past Projects",
  "Exec History",
  "How to Apply",
  "External Links",
] as const;

type ResearchResult = {
  section: string;
  status: "completed" | "skipped";
  sources: string[];
  summary: string;
};

export async function createIdentificationJob(
  input: string,
  categoryHint: OrgCategory | undefined,
  admin: CurrentUser,
) {
  const type = /^https?:\/\//i.test(input) ? "url" : "name";
  const metadata = await identifyOrg(input, categoryHint);
  const client = createAdminClient();
  const { data, error } = await client
    .from("cold_start_jobs")
    .insert({
      created_by: admin.id,
      input_text: input,
      input_type: type,
      status: "awaiting_confirmation",
      category_hint: categoryHint ?? null,
      org_metadata: metadata,
      current_step: "identified",
      section_progress: SECTION_TITLES.map((title) => ({
        slug: slugify(title),
        title,
        status: "pending",
      })),
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create cold-start job.");
  return { jobId: data.id, orgMetadata: metadata };
}

export async function generateDraftForJob(
  jobId: string,
  orgMetadata: OrgMetadataInput,
  _admin: CurrentUser,
) {
  const client = createAdminClient();
  await client
    .from("cold_start_jobs")
    .update({
      status: "researching",
      org_metadata: orgMetadata,
      current_step: "researching",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const research = await researchOrg(orgMetadata);
  const draft = synthesizeDraft(orgMetadata, research);
  const pulseEstimates = estimatePulse(orgMetadata, research);
  const sectionSources = Object.fromEntries(
    research.map((item) => [slugify(item.section), item.sources]),
  );

  const { error } = await client
    .from("cold_start_jobs")
    .update({
      status: "ready_for_preview",
      research_data: { results: research },
      draft_content_json: draft,
      pulse_estimates: pulseEstimates,
      section_sources: sectionSources,
      section_progress: research.map((item) => ({
        slug: slugify(item.section),
        title: item.section,
        status: item.status,
        sourceCount: item.sources.length,
      })),
      tavily_call_count: env.TAVILY_API_KEY ? Math.min(research.length, 20) : 0,
      current_step: "ready_for_preview",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw error;

  return { jobId, draftContentJson: draft, pulseEstimates, sectionSources };
}

export async function getColdStartJob(jobId: string) {
  const client = createAdminClient();
  const { data, error } = await client
    .from("cold_start_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateColdStartDraft(jobId: string, contentJson: unknown) {
  const validation = validateProposalDoc(contentJson);
  if (!validation.ok) throw new Error(validation.error);
  const client = createAdminClient();
  const { error } = await client
    .from("cold_start_jobs")
    .update({
      draft_content_json: contentJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw error;
}

export async function publishColdStartJob(jobId: string, contentOverride?: unknown) {
  const client = createAdminClient();
  const job = await getColdStartJob(jobId);
  if (!job) throw new Error("Cold-start job not found.");
  const orgMeta = job.org_metadata as OrgMetadataInput;
  const contentJson = (contentOverride ?? job.draft_content_json) as ProseMirrorDoc;
  const validation = validateProposalDoc(contentJson);
  if (!validation.ok) throw new Error(validation.error);

  const orgSlug = orgMeta.slug ?? slugify(orgMeta.name);
  const { data: orgRow, error: orgError } = await client
    .from("organizations")
    .upsert(
      {
        university_id: WATERLOO_ID,
        org_slug: orgSlug,
        org_name: orgMeta.name,
        category: orgMeta.category,
        tagline: orgMeta.oneLiner ?? null,
        claimed_status: "unclaimed",
      },
      { onConflict: "university_id,org_slug" },
    )
    .select("id,university_id,org_slug,org_name,category")
    .single();
  if (orgError || !orgRow) throw orgError ?? new Error("Could not upsert org.");

  const { data: pageRow, error: pageError } = await client
    .from("pages")
    .upsert(
      {
        org_id: orgRow.id,
        slug: orgSlug,
        content_json: contentJson,
        last_modified_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("id,current_version_id")
    .single();
  if (pageError || !pageRow) throw pageError ?? new Error("Could not upsert page.");

  const { data: existingVersions } = await client
    .from("page_versions")
    .select("version_number")
    .eq("page_id", pageRow.id);
  const versionNumber =
    Math.max(0, ...((existingVersions ?? []).map((row) => row.version_number ?? 0))) + 1;

  const { data: versionRow, error: versionError } = await client
    .from("page_versions")
    .insert({
      page_id: pageRow.id,
      content_json: contentJson,
      is_current: true,
      is_anonymous: false,
      is_admin_seeded: true,
      is_cold_start: true,
      author_id: job.created_by ?? null,
      edit_summary: "Cold-start generated initial draft",
      summary: "Cold-start generated initial draft",
      version_number: versionNumber,
    })
    .select("id")
    .single();
  if (versionError || !versionRow) {
    throw versionError ?? new Error("Could not create page version.");
  }

  await client
    .from("page_versions")
    .update({ is_current: false })
    .eq("page_id", pageRow.id)
    .neq("id", versionRow.id);
  await client
    .from("pages")
    .update({
      current_version_id: versionRow.id,
      content_json: contentJson,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", pageRow.id);

  await seedPulseAggregates(orgRow.id, job.pulse_estimates ?? {});

  await client
    .from("cold_start_jobs")
    .update({
      status: "published",
      published_org_id: orgRow.id,
      published_page_id: pageRow.id,
      published_page_version_id: versionRow.id,
      completed_at: new Date().toISOString(),
      current_step: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await reembedPage(
    pageRow.id,
    {
      universityId: orgRow.university_id,
      orgId: orgRow.id,
      orgName: orgRow.org_name,
      orgSlug: orgRow.org_slug,
      category: orgRow.category,
      pageVersionId: versionRow.id,
    },
    contentJson,
  ).catch((error) => logServerError("cold-start.publish.reembed", error));

  return { orgSlug, pageId: pageRow.id, pageVersionId: versionRow.id };
}

export async function rerunColdStartJob(jobId: string, admin: CurrentUser) {
  const job = await getColdStartJob(jobId);
  if (!job) throw new Error("Cold-start job not found.");
  if (job.status !== "failed") {
    throw new Error("Only failed cold-start jobs can be rerun.");
  }
  const result = await createIdentificationJob(
    job.input_text,
    job.category_hint ?? undefined,
    admin,
  );
  await createAdminClient()
    .from("cold_start_jobs")
    .update({ supersedes_job_id: jobId })
    .eq("id", result.jobId);
  return result;
}

async function identifyOrg(input: string, categoryHint?: OrgCategory): Promise<OrgMetadataInput> {
  const name = deriveName(input);
  const search = await tavilySearch(`${name} University of Waterloo student team`);
  const oneLiner =
    search[0]?.content ??
    (categoryHint === "Design Teams"
      ? `${name} is a University of Waterloo student design team.`
      : `${name} is a University of Waterloo student organization.`);
  return {
    name,
    slug: slugify(name),
    oneLiner: oneLiner.slice(0, 180),
    website: search[0]?.url,
    category: categoryHint ?? inferCategory(name),
    confidence: search.length > 0 ? "medium" : "low",
    sources: search.flatMap((item) => (item.url ? [item.url] : [])),
  };
}

async function researchOrg(org: OrgMetadataInput): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];
  for (const section of SECTION_TITLES) {
    const search = await tavilySearch(`${org.name} University of Waterloo ${section}`);
    const summary =
      search.map((item) => item.content).filter(Boolean).join(" ") ||
      fallbackSectionText(org, section);
    results.push({
      section,
      status: summary ? "completed" : "skipped",
      sources: search.flatMap((item) => (item.url ? [item.url] : [])),
      summary,
    });
  }
  return results;
}

function synthesizeDraft(
  org: OrgMetadataInput,
  research: ResearchResult[],
): ProseMirrorDoc {
  const content = research.flatMap((item) => [
    {
      type: "heading",
      attrs: { level: 2, slug: slugify(item.section) },
      content: [{ type: "text", text: item.section }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: item.summary || fallbackSectionText(org, item.section),
        },
      ],
    },
  ]);
  return {
    type: "doc",
    content: content.length > 0 ? content : SUGGESTED_TEMPLATE.content,
  } as ProseMirrorDoc;
}

function estimatePulse(
  org: OrgMetadataInput,
  research: ResearchResult[],
): { selectivity: string | null; techStack: string[] | null; vibeCheck: null; coopBoost: null } {
  const text = research.map((item) => item.summary).join(" ");
  const tech = [
    "ROS2",
    "C++",
    "Python",
    "SolidWorks",
    "Altium",
    "React",
    "Docker",
  ].filter((tag) => new RegExp(`\\b${escapeRegex(tag)}\\b`, "i").test(text));
  const selectivity = /application|apply|interview/i.test(text)
    ? "Application-Based"
    : /invite/i.test(text)
      ? "Invite-Only"
      : "Open Membership";
  return {
    selectivity,
    techStack: tech.length > 0 ? tech : null,
    vibeCheck: null,
    coopBoost: null,
  };
}

async function seedPulseAggregates(orgId: string, estimates: Record<string, unknown>) {
  const client = createAdminClient();
  const rows = [];
  if (typeof estimates.selectivity === "string") {
    rows.push({
      org_id: orgId,
      metric: "selectivity",
      aggregate_value: estimates.selectivity,
      aggregate_label: estimates.selectivity,
      total_votes: 1,
    });
  }
  if (Array.isArray(estimates.techStack) && estimates.techStack.length > 0) {
    const value = estimates.techStack.join(", ");
    rows.push({
      org_id: orgId,
      metric: "tech_stack",
      aggregate_value: value,
      aggregate_label: value,
      total_votes: 1,
    });
  }
  if (rows.length > 0) {
    await client.from("pulse_aggregates").upsert(rows, { onConflict: "org_id,metric" });
  }
}

async function tavilySearch(query: string): Promise<Array<{ title?: string; url?: string; content?: string }>> {
  if (!env.TAVILY_API_KEY) return [];
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        max_results: 3,
        search_depth: "basic",
      }),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return body.results ?? [];
  } catch (error) {
    logServerError("cold-start.tavily", error);
    return [];
  }
}

function deriveName(input: string): string {
  try {
    const url = new URL(input);
    return url.hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
  } catch {
    return input.trim();
  }
}

function inferCategory(name: string): OrgCategory {
  if (/program|engineering/i.test(name)) return "Academic Programs";
  if (/society/i.test(name)) return "Student Societies";
  return "Design Teams";
}

function fallbackSectionText(org: OrgMetadataInput, section: string): string {
  if (section === "Overview") {
    return org.oneLiner ?? `${org.name} is a University of Waterloo organization.`;
  }
  if (section === "External Links") {
    return org.website ? `Website: ${org.website}` : "No external links found yet.";
  }
  return `No reliable public information found for ${section.toLowerCase()} yet.`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
