import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { openrouter } from "@/lib/ai/provider";
import { reembedPage } from "@/lib/ai/embeddings";
import { logServerError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import { markdownToProseMirrorNodes } from "@/lib/prosemirror/from-markdown";
import { validateProposalDoc } from "@/lib/prosemirror/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import { SUGGESTED_TEMPLATE } from "@/lib/wiki/template";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { OrgCategory, ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";
import type { OrgMetadataInput } from "@/lib/cold-start/schemas";

const COLD_START_SYNTHESIS_SYSTEM = `You are writing a neutral, encyclopedic Wikipedia-style article ABOUT a student organization at the University of Waterloo. You are NOT the organization. You are an outside observer summarizing what is publicly known.

VOICE (non-negotiable):
- Always third-person. Never use "we", "us", "our", "I", "you", "your", "let's".
- Refer to the org by its name, or as "the team", "the club", "the organization", or "members".
- Past tense for finished events, present tense for ongoing facts.
- No exclamation points. No marketing hype. No emojis.

EVIDENCE HANDLING (most important):
- The research evidence below is messy web scrapes. Most of it is NOISE. Be aggressive about ignoring irrelevant content.
- Specifically IGNORE and never include: land acknowledgements (Haldimand Tract, Neutral/Anishinaabeg/Haudenosaunee), Sedra Student Design Centre boilerplate, university navigation menus, "Learn more about…" CTAs, donation pitches, employee count tables, RocketReach/Apollo/SignalHire data, follower counts ("1,793 followers"), generic UW admissions requirements, Waterloo presidents (Burt Matthews, James Downey, Doug Wright, Vivek Goel), Waterloo university history, Med School Study Planner content, University of Washington Diversity Blueprint content.
- If most of a section's evidence looks unrelated to this specific organization, OMIT the section entirely (add its title to droppedSections).
- NEVER copy phrases verbatim from the source. Always paraphrase in your own neutral words.
- Do not invent facts. If unsure, omit.

STRUCTURE:
- Each kept section: 2–5 sentences of plain encyclopedic prose. NO sub-headings unless the source clearly enumerates a list (then use "### Subheading" sparingly).
- Use bullet lists ONLY for genuinely list-like content: project teams, past nonprofit partners, exec roles. Otherwise prose.
- "External Links" section: ONLY a short bullet list of clean official URLs (website, Instagram, LinkedIn, GitHub). Format: "- [Label](url)". Skip if no clean URLs.

OUTPUT FORMAT:
- Output a JSON object matching the schema: { sections: [{title, markdown}], droppedSections: [string] }
- Section titles should match the candidate names provided (Overview, Time Commitment, Culture and Vibe, Subteams and Roles, Past Projects, Exec History, How to Apply, External Links). You may omit any.
- "Overview" should always be present if any reliable info exists.
`;

type SynthesizedDraft = {
  sections: Array<{ title: string; markdown: string }>;
  droppedSections: string[];
};

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
  const draft = await synthesizeDraftWithLLM(orgMetadata, research);
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

// Domains known to produce noise for UW org research
const TAVILY_BLOCKED_DOMAINS = [
  "blueprintprep.com", // Blueprint Test Prep (med school)
  "washington.edu", // University of Washington
  "rocketreach.co",
  "signalhire.com",
  "thecompaniesapi.com",
  "leadiq.com",
  "apollo.io",
  "zoominfo.com",
  "uwaterloo.ca/sedra-student-design-centre",
  "uwaterloo.ca/about/who-we-are/indigenous-relations",
  "uwaterloo.ca/future-students",
  "uwaterloo.ca/admissions",
];

// Patterns matching obvious scrape artifacts to strip from raw text before LLM
const NOISE_PATTERNS: RegExp[] = [
  /The University of Waterloo acknowledges that much of our work[\s\S]*?Office of Indigenous Relations\.?/gi,
  /Haldimand Tract[\s\S]*?Six Nations[\s\S]*?Grand River\.?/gi,
  /Sedra Student Design Centre[\s\S]*?(N2L 3G1 Canada|Engineering Website Help)/gi,
  /200 University Avenue[\s\S]*?N2L 3G1 Canada/gi,
  /Learn more about the Educating the Engineer of the Future[\s\S]*?ways to support\.?/gi,
  /Information about the University of Waterloo/gi,
  /Information about Sedra Student Design Centre/gi,
  /Provide website feedback\s*Engineering Website Help/gi,
  /\d+\s*(likes|followers)\b/gi,
  /\bExternal link for [^\n]+/gi,
  /Get Verified Emails/gi,
  /View All Employees/gi,
  /\bView contact profiles from [^\n]+/gi,
  /Click here to view [^\n]+/gi,
  /Open in app\s*Sign up\s*Sign in/gi,
  /Sitemap\s*Open in app/gi,
  /Press enter or click to view image in full size/gi,
  /\[\.\.\.\]/g,
  /Right carat/g,
  // University of Washington Diversity Blueprint (totally unrelated)
  /Diversity Blueprint[\s\S]*?University of Washington[\s\S]*?(Indigenous|inclusion)/gi,
  /Med School Study Planner[\s\S]*?(study schedule|hours per day)/gi,
  /Blueprint Help Center[\s\S]*?Setting Study Hours/gi,
];

function stripNoise(text: string): string {
  let out = text;
  for (const pattern of NOISE_PATTERNS) out = out.replace(pattern, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function deriveDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAllowedSnippet(url: string | undefined, content: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  if (TAVILY_BLOCKED_DOMAINS.some((d) => lowerUrl.includes(d))) return false;
  // Reject pure navigation/menu dumps (very low signal-to-noise)
  if (content.length < 80) return false;
  // Reject snippets that are >40% PDF / image / employee-list boilerplate
  if (/View All Employees|RocketReach|SignalHire|Apollo\.io/i.test(content)) return false;
  return true;
}

async function researchOrg(org: OrgMetadataInput): Promise<ResearchResult[]> {
  const orgDomain = deriveDomain(org.website);
  // Run a small set of targeted queries instead of one per section.
  // Each query returns up to 8 results — we'll deduplicate and pre-filter.
  const queries = [
    {
      q: `${org.name} University of Waterloo student club overview`,
      includeDomains: orgDomain ? [orgDomain] : undefined,
    },
    { q: `${org.name} University of Waterloo project teams subteams members` },
    { q: `${org.name} University of Waterloo recruitment apply application` },
    { q: `${org.name} University of Waterloo time commitment hours per week` },
    { q: `${org.name} University of Waterloo past projects partners` },
  ];

  const seenUrls = new Set<string>();
  const collected: Array<{ url: string; content: string; title?: string }> = [];

  for (const { q, includeDomains } of queries) {
    const search = await tavilySearch(q, { includeDomains, maxResults: 8 });
    for (const item of search) {
      if (!item.url || !item.content) continue;
      if (seenUrls.has(item.url)) continue;
      const cleaned = stripNoise(item.content);
      if (!isAllowedSnippet(item.url, cleaned)) continue;
      seenUrls.add(item.url);
      collected.push({ url: item.url, content: cleaned, title: item.title });
    }
  }

  // Bucket the deduplicated, cleaned snippets by section heuristically so the
  // LLM gets a structured but compact evidence packet. Each section gets
  // snippets whose text matches its heuristic; the "Overview" bucket is a
  // catch-all so nothing is lost.
  const sectionBuckets = new Map<string, Array<{ url: string; content: string }>>();
  for (const title of SECTION_TITLES) sectionBuckets.set(title, []);

  for (const snippet of collected) {
    const matched = matchSections(snippet.content);
    if (matched.length === 0) {
      sectionBuckets.get("Overview")!.push(snippet);
    } else {
      for (const m of matched) sectionBuckets.get(m)!.push(snippet);
    }
  }

  const results: ResearchResult[] = [];
  for (const section of SECTION_TITLES) {
    const bucket = sectionBuckets.get(section)!;
    // Cap each bucket so the LLM context stays small (~400 chars per snippet,
    // up to 4 snippets per section).
    const trimmed = bucket
      .slice(0, 4)
      .map((s) => s.content.slice(0, 600))
      .join(" \n\n ");
    results.push({
      section,
      status: trimmed ? "completed" : "skipped",
      sources: bucket.slice(0, 4).map((s) => s.url),
      summary: trimmed || fallbackSectionText(org, section),
    });
  }
  return results;
}

function matchSections(content: string): string[] {
  const lower = content.toLowerCase();
  const out: string[] = [];
  if (/(time commitment|hours per week|hours\/week|10 hours)/.test(lower)) {
    out.push("Time Commitment");
  }
  if (/(culture|values|vibe|social|retreat|community)/.test(lower)) {
    out.push("Culture and Vibe");
  }
  if (/(subteam|project team|developer|designer|product manager|technical lead|director|vp )/.test(lower)) {
    out.push("Subteams and Roles");
  }
  if (/(past project|partnered|nonprofit partner|previously worked|case study)/.test(lower)) {
    out.push("Past Projects");
  }
  if (/(president|founder|founded in|exec history|leadership|alumni)/.test(lower)) {
    out.push("Exec History");
  }
  if (/(apply|application|recruitment|how to join|interview|hiring)/.test(lower)) {
    out.push("How to Apply");
  }
  if (/(linkedin|instagram|github|medium|website)/.test(lower)) {
    out.push("External Links");
  }
  return out;
}

async function synthesizeDraftWithLLM(
  org: OrgMetadataInput,
  research: ResearchResult[],
): Promise<ProseMirrorDoc> {
  // Build a compact evidence packet for the LLM. Snippets have already been
  // domain-filtered and noise-stripped in researchOrg().
  const evidence = research
    .filter((item) => item.summary && item.summary.length > 60)
    .map((item) => {
      const trimmed = item.summary.slice(0, 2400);
      const sources = item.sources.slice(0, 3).join(", ");
      return `### Candidate section: ${item.section}\nSources: ${sources}\nNotes: ${trimmed}`;
    })
    .join("\n\n");

  const userPrompt = `Organization: ${org.name}
Category: ${org.category}
One-liner: ${org.oneLiner ?? "(none)"}
Official website: ${org.website ?? "(none)"}

Write a neutral, third-person Wikipedia-style article about this organization using ONLY the evidence below as a starting point. Be ruthless: the evidence contains a lot of irrelevant scrapes — discard anything that isn't clearly about ${org.name} as a UW student organization.

Sections to consider (omit any that lack real evidence — list dropped titles in droppedSections):
${SECTION_TITLES.map((t) => `- ${t}`).join("\n")}

Evidence:

${evidence || "(no usable evidence)"}`;

  let synthesized: SynthesizedDraft | null = null;
  try {
    const { object } = await generateObject({
      model: openrouter.chat("google/gemini-2.5-flash"),
      schema: z.object({
        sections: z.array(
          z.object({
            title: z.string().min(1).max(120),
            markdown: z.string().min(1).max(4000),
          }),
        ),
        droppedSections: z.array(z.string()),
      }),
      system: COLD_START_SYNTHESIS_SYSTEM,
      prompt: userPrompt,
      maxOutputTokens: 6000,
      temperature: 0.3,
    });
    synthesized = object;
  } catch (error) {
    logServerError("cold-start.synthesize", error);
  }

  if (!synthesized || synthesized.sections.length === 0) {
    return synthesizeDraftFallback(org, research);
  }

  const docContent: ProseMirrorNode[] = [];
  for (const section of synthesized.sections) {
    const heading: ProseMirrorNode = {
      type: "heading",
      attrs: { level: 2, slug: slugify(section.title) },
      content: [{ type: "text", text: section.title }],
    };
    const body = markdownToProseMirrorNodes(section.markdown);
    if (body.length === 0) continue; // skip empties
    docContent.push(heading, ...body);
  }

  if (docContent.length === 0) return synthesizeDraftFallback(org, research);

  const doc: ProseMirrorDoc = {
    type: "doc",
    content: docContent,
  } as ProseMirrorDoc;

  const validation = validateProposalDoc(doc);
  if (!validation.ok) {
    logServerError("cold-start.synthesize.validate", new Error(validation.error));
    return synthesizeDraftFallback(org, research);
  }
  return doc;
}

function synthesizeDraftFallback(
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

async function tavilySearch(
  query: string,
  opts: { includeDomains?: string[]; excludeDomains?: string[]; maxResults?: number } = {},
): Promise<Array<{ title?: string; url?: string; content?: string }>> {
  if (!env.TAVILY_API_KEY) return [];
  try {
    const body: Record<string, unknown> = {
      api_key: env.TAVILY_API_KEY,
      query,
      max_results: opts.maxResults ?? 5,
      search_depth: "advanced",
    };
    if (opts.includeDomains?.length) body.include_domains = opts.includeDomains;
    if (opts.excludeDomains?.length) body.exclude_domains = opts.excludeDomains;
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    return data.results ?? [];
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
