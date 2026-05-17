import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { openrouter } from "@/lib/ai/provider";
import { reembedPage } from "@/lib/ai/embeddings";
import { logServerError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import { validateProposalDoc } from "@/lib/prosemirror/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { OrgCategory, ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";
import type { OrgMetadataInput } from "@/lib/cold-start/schemas";
import type { ColdStartProgressEvent } from "@/lib/cold-start/progress-events";

export type { ColdStartProgressEvent } from "@/lib/cold-start/progress-events";

const COLD_START_SYNTHESIS_SYSTEM = `You are writing a neutral, encyclopedic Wikipedia-style article ABOUT a student organization at the University of Waterloo. You are NOT the organization. You are an outside observer summarizing what is publicly known.

VOICE (non-negotiable):
- Always third-person. Never use "we", "us", "our", "I", "you", "your", "let's".
- Refer to the org by its name, or as "the team", "the club", "the organization", or "members".
- Past tense for finished events, present tense for ongoing facts.
- No exclamation points. No marketing hype. No emojis.

EVIDENCE HANDLING (most important):
- The research evidence below is messy web scrapes. Most of it is NOISE. Be aggressive about ignoring irrelevant content.
- Specifically IGNORE and never include: land acknowledgements (Haldimand Tract, Neutral/Anishinaabeg/Haudenosaunee), Sedra Student Design Centre boilerplate, university navigation menus, "Learn more about…" CTAs, donation pitches, employee count tables, RocketReach/Apollo/SignalHire data, follower counts ("1,793 followers"), generic UW admissions requirements, Waterloo presidents (Burt Matthews, James Downey, Doug Wright, Vivek Goel), Waterloo university history, Med School Study Planner content, University of Washington Diversity Blueprint content.
- NEVER copy phrases verbatim from the source. Always paraphrase in your own neutral words.
- Entity names (partner names, project names, competition names, years) are facts — they should always appear verbatim even when paraphrasing surrounding prose.
- Do not invent facts. If unsure about a claim, omit it.

CONFLICTING EVIDENCE:
- If two sources disagree on a fact (e.g., one says "founded 2015", another says "founded 2018"), write the range ("founded around 2015–2018") or attribute one source ("according to the org's website, founded in 2015"). Never silently omit conflicting facts — surface the disagreement or use the most credible source.

CONCRETE ENTITIES (very important — this is what makes the article good):
- When evidence names specific partners, sponsors, events, competitions, awards, founding years, team sizes, or notable alumni, INCLUDE THEM by name. Examples: "founded in 1988", "flagship competition CxC has attracted over 128 participants", "partners include Sistema Toronto and A Better Tent City", "approximately 100 active members across all six faculties".
- If a section's evidence mentions even one concrete entity, that section is worth keeping. Lead with the entity.

SECTION-SPECIFIC RULES:

"History" section: This covers founding year and founders (if known), major milestones and achievements (competition placements, record-breaking events, awards), and any notable leadership transitions or eras. Write it as the org's timeline in encyclopedic prose.

"Past Projects" section: List specific NAMED events, competitions, deliverables, or flagship programs (e.g. "CxC Data Challenge", "ML bootcamp series", "American Solar Challenge 2022"). If the evidence names them, list them. If the evidence only confirms that events exist but doesn't name them, write: "Specific past events and projects have not been publicly documented." Do NOT drop this section even if evidence is thin — it must always appear.

"Subteams and Roles" section: List exec positions and team divisions by name. Use a bullet list if there are 3+ distinct roles. Include estimated team sizes if evidenced.

"External Links" section (CRITICAL): Output a bullet list using REAL markdown hyperlinks with the format "- [Human-readable label](https://actual-url.com)". Use the Known URLs provided in the prompt metadata. NEVER write "Official Website" as bare text without a real href. If no clean URLs are available, OMIT this section entirely.

SOURCE RELIABILITY:
- Treat reddit.com snippets as anecdotal. Use ONLY for culture/recruitment color, never to claim factual numbers, awards, or partnerships.
- Org's own website / Medium posts: trustworthy for self-described mission, projects, partners.
- Anything from rocketreach/apollo/signalhire/zoominfo: ignore entirely.

STRUCTURE:
- Write as much as the evidence supports — there is no sentence limit per section. Fill each section fully, but do NOT pad with generic filler. Every sentence must add new, specific information not stated elsewhere in the article.
- Use prose for narrative content. Use bullet lists for genuinely enumerable content: exec roles, project team names, nonprofit client list, competition results.
- No sub-headings within sections unless the source clearly enumerates distinct categories.

CITATIONS (very important):
- Every factual sentence (years, names, numbers, partners, awards, projects) SHOULD cite at least one refId from the per-section source pool.
- Cite refIds from the section's listed pool whenever possible. If a refId from a different section's pool also supports the claim, you may cite it.
- 1-3 refIds per factual sentence is ideal. Generic glue sentences ("The team has several subteams.") do not need citations.
- Never invent refIds — only cite numbers that appear in the Source pool you were given.
- If a section's evidence is too thin to support any specific claim, write a short, neutral sentence WITHOUT citations rather than dropping the section.

OUTPUT FORMAT:
- Output a JSON object: { sections: [{title, blocks: [...]}], droppedSections: [string] }
- Each block has a "kind" — one of "paragraph", "bulletList", "linkList".
  • "paragraph" block: provide "sentences": [{text, citations: number[]}]. Use for prose narrative.
  • "bulletList" block: provide "items": [{text, citations: number[]}]. Use for enumerable content like roles, partners, projects.
  • "linkList" block: provide "links": [{label, url}]. Use ONLY for the External Links section. No citations needed (each item IS its source).
- Section titles must be from: Overview, Time Commitment, Culture and Vibe, Subteams and Roles, Past Projects, History, How to Apply, External Links.
- "Overview" and "Past Projects" must always be present.
- Do NOT invent an "Other" or "References" section — references are generated automatically.
`;

const PROGRAM_SYNTHESIS_SYSTEM = `You are writing a neutral, encyclopedic Wikipedia-style article ABOUT a DEGREE PROGRAM at the University of Waterloo. The subject is a university degree, NOT a student club. Write like an outside observer summarizing what is publicly known about the program.

VOICE (non-negotiable):
- Always third-person. Never use "we", "us", "our", "I", "you", "your", "let's".
- Refer to the program by its name, or as "the program", "the degree", "students in the program".
- Present tense for ongoing facts, past tense for finished events.
- No exclamation points. No marketing hype. No emojis.

EVIDENCE HANDLING (most important):
- The research evidence below is messy web scrapes. Most of it is NOISE. Be aggressive about ignoring irrelevant content.
- Specifically IGNORE and never include: land acknowledgements (Haldimand Tract, Neutral/Anishinaabeg/Haudenosaunee), university navigation menus, "Learn more about…" CTAs, donation pitches, generic Waterloo presidents (Burt Matthews, James Downey, Doug Wright, Vivek Goel), unrelated programs at other universities (University of Washington, Wilfrid Laurier University), and unrelated student clubs.
- NEVER copy phrases verbatim from the source. Always paraphrase in your own neutral words.
- Entity names (course codes, professor names, employer names, salary numbers) are facts — they should always appear verbatim even when paraphrasing surrounding prose.
- Do not invent facts. If unsure about a claim, omit it.

CONFLICTING EVIDENCE:
- If two sources disagree on a fact (e.g., one says admit cutoff 92%, another says 95%), write the range ("approximately 92–95%") or attribute one source ("according to the official program page, …"). Never silently omit conflicting facts.

CONCRETE ENTITIES (very important — this is what makes the article good):
- When evidence names specific course codes (e.g. CS 246, ECE 350, MATH 137), required courses, specializations/options, employer names (Google, Shopify, Meta), specific salary ranges, admit cutoffs, AIF requirements, capstone structures — INCLUDE THEM by name and number.
- If a section's evidence mentions even one concrete entity, that section is worth keeping. Lead with the entity.

SECTION-SPECIFIC RULES:

"Overview": What the program is, the faculty/department it belongs to, length in years, plan format (regular vs co-op), and approximate cohort size if evidenced. One paragraph.

"Curriculum": Required core courses (cite course codes when known), available electives/streams/specializations/options, capstone or thesis structure, technical depth. Use a bullet list for specializations or required course groupings; use prose for narrative description of the structure.

"Co-op & Career": Co-op sequence (study/work alternation, number of work terms), average salary by stream if evidenced, top employers, common job titles, employment rate. Past Waterloo-specific data preferred.

"Admissions": Admit average cutoff (latest known year), AIF (Admission Information Form) requirements, supplementary requirements, application deadlines, secondary school prerequisites.

"Culture": Workload intensity, community vibe, student demographics (gender ratio, faculty composition), work-life balance, perception on r/uwaterloo or UWFlow. Use anecdotal evidence with hedging ("students often report…", "the program is generally described as…").

"Resources" (CRITICAL): Output a bullet list of REAL markdown hyperlinks with the format "- [Human-readable label](https://actual-url.com)". Use the Known URLs provided in the prompt metadata. Cover: official program page on uwaterloo.ca, course calendar (ucalendar.uwaterloo.ca), undergraduate office contact, useful subreddits, UWFlow program page. NEVER write "Official Website" as bare text without a real href. If no clean URLs are available, OMIT this section entirely.

SOURCE RELIABILITY:
- Treat reddit.com and uwflow.com snippets as anecdotal. Use for culture/workload color, never for hard facts like admit cutoffs.
- uwaterloo.ca / ucalendar.uwaterloo.ca / findoutmore.uwaterloo.ca: trustworthy for course codes, plan structure, admission requirements.
- Anything from third-party degree-ranking sites or unrelated universities: ignore entirely.

STRUCTURE:
- Write as much as the evidence supports — there is no sentence limit per section. Fill each section fully, but do NOT pad with generic filler.
- Use prose for narrative content. Use bullet lists for genuinely enumerable content: required courses, specializations, top employers, application requirements.
- No sub-headings within sections unless the source clearly enumerates distinct categories.

CITATIONS (very important):
- Every factual sentence (course codes, employers, salaries, cutoffs, deadlines) SHOULD cite at least one refId from the per-section source pool.
- 1-3 refIds per factual sentence is ideal. Generic glue sentences do not need citations.
- Never invent refIds — only cite numbers that appear in the Source pool you were given.

OUTPUT FORMAT:
- Output a JSON object: { sections: [{title, blocks: [...]}], droppedSections: [string] }
- Each block has a "kind" — one of "paragraph", "bulletList", "linkList".
  • "paragraph" block: provide "sentences": [{text, citations: number[]}].
  • "bulletList" block: provide "items": [{text, citations: number[]}].
  • "linkList" block: provide "links": [{label, url}]. ONLY for the Resources section.
- Section titles must be from: Overview, Curriculum, Co-op & Career, Admissions, Culture, Resources.
- "Overview" must always be present.
- Do NOT invent extra sections — references are generated automatically.
`;

const FOLLOWUP_SYSTEM = `You just read web search results about a student organization at the University of Waterloo. Your job is to identify SPECIFIC NAMED ENTITIES that were mentioned but not yet fully detailed — partner nonprofits, sponsors, specific events, competitions, workshops, awards, founding year, founders' names, notable alumni — and emit 4 to 6 focused web search queries that would surface concrete facts about those entities.

Rules:
- Each query should target ONE specific entity or fact gap. Good examples:
  "Midnight Sun American Solar Challenge 2022 results"
  "UW Blueprint Sistema Toronto collaboration details"
  "UW Data Science Club CxC Data Challenge history winners"
  "UWDSC CxC competition 2023 2024"
  "Waterloo Data Science Club founding year history"
- Pay special attention to NAMED FLAGSHIP EVENTS (like CxC, a named hackathon, a named bootcamp series). If you spotted one, search for its history, past editions, and results.
- Also look for: official website URL, Instagram handle, LinkedIn page, GitHub org — if the evidence hints at these but doesn't give the full URL.
- Do NOT re-ask the broad questions already covered by the first pass (overview, recruitment, time commitment, projects, partners) — those were already searched.
- If the first-pass evidence is too thin to identify entities, return an empty array.
- Output only the queries — no commentary.`;

type CitedFragment = { text: string; citations: number[] };

type SynthesizedBlock =
  | { kind: "paragraph"; sentences: CitedFragment[] }
  | { kind: "bulletList"; items: CitedFragment[] }
  | { kind: "linkList"; links: Array<{ label: string; url: string }> };

type SynthesizedDraft = {
  sections: Array<{ title: string; blocks: SynthesizedBlock[] }>;
  droppedSections: string[];
};

type ReferenceEntry = {
  refId: number;
  url: string;
  title: string;
};

const WATERLOO_ID = "00000000-0000-0000-0000-000000000001";

const CLUB_SECTION_TITLES = [
  "Overview",
  "Time Commitment",
  "Culture and Vibe",
  "Subteams and Roles",
  "Past Projects",
  "History",
  "How to Apply",
  "External Links",
] as const;

const PROGRAM_SECTION_TITLES = [
  "Overview",
  "Curriculum",
  "Co-op & Career",
  "Admissions",
  "Culture",
  "Resources",
] as const;

type SectionTitle = string;

/**
 * Canonical section list for a given org category. Clubs/design teams/etc.
 * follow the original 8-section structure; Academic Programs use a degree-
 * shaped layout (Curriculum / Co-op / Admissions / Culture / Resources).
 *
 * The pipeline downstream (bucketing, synthesis prompt, draft renderer) reads
 * from this helper rather than the legacy `SECTION_TITLES` constant.
 */
function getSectionTitles(category: OrgCategory | string | undefined): readonly SectionTitle[] {
  return category === "Academic Programs"
    ? PROGRAM_SECTION_TITLES
    : CLUB_SECTION_TITLES;
}

function isProgramCategory(category: OrgCategory | string | undefined): boolean {
  return category === "Academic Programs";
}

type ResearchResult = {
  section: string;
  status: "completed" | "skipped";
  sources: string[];
  summary: string;
  /** url → human-readable title, for building references */
  sourceTitles?: Record<string, string>;
};

// Progress events emitted during draft generation. The actual type lives in
// progress-events.ts (re-exported above) so client components can import it
// without pulling in the server-only service module.
export type ProgressEmitter = (event: ColdStartProgressEvent) => void | Promise<void>;

const NOOP_EMIT: ProgressEmitter = () => {};

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
      section_progress: getSectionTitles(metadata.category).map((title) => ({
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
  emit: ProgressEmitter = NOOP_EMIT,
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

  await emit({ kind: "phase", label: "Researching the web" });
  const research = await researchOrg(orgMetadata, emit);
  await emit({ kind: "phase", label: "Writing the article" });
  let draft: ProseMirrorDoc;
  try {
    draft = await synthesizeDraftWithLLM(orgMetadata, research);
  } catch (error) {
    // Detail was already logged at the throw site. Persist + propagate a
    // generic message so the admin UI / stream client never sees provider /
    // model / parse internals.
    const publicMessage = "Cold-start synthesis failed. Please try again.";
    await client
      .from("cold_start_jobs")
      .update({
        status: "failed",
        current_step: "synthesis_failed",
        error: publicMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw error instanceof Error && error.name === "ColdStartSynthesisError"
      ? error
      : new Error(publicMessage);
  }
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

async function researchOrg(
  org: OrgMetadataInput,
  emit: ProgressEmitter = NOOP_EMIT,
): Promise<ResearchResult[]> {
  const orgDomain = deriveDomain(org.website);

  // --- Phase 1: broad sweep ---
  // For Academic Programs we target degree-shaped queries (curriculum, admit
  // average, co-op employers) and trusted Waterloo domains (program page,
  // course calendar, UWFlow); drop the club-shaped Medium publication crawl.
  // For everything else we keep the original club sweep.
  const phase1: Array<{ q: string; includeDomains?: string[]; source: string }> =
    isProgramCategory(org.category)
      ? [
          {
            q: `${org.name} University of Waterloo program overview faculty`,
            includeDomains: ["uwaterloo.ca"],
            source: "uwaterloo.ca",
          },
          {
            q: `${org.name} Waterloo curriculum required courses electives specializations`,
            includeDomains: ["uwaterloo.ca", "ucalendar.uwaterloo.ca"],
            source: "ucalendar.uwaterloo.ca",
          },
          {
            q: `${org.name} Waterloo co-op employers salary work term`,
            source: "web",
          },
          {
            q: `${org.name} Waterloo admission average cutoff AIF requirements`,
            includeDomains: ["uwaterloo.ca", "findoutmore.uwaterloo.ca"],
            source: "findoutmore.uwaterloo.ca",
          },
          {
            q: `${org.name} Waterloo program review workload culture`,
            includeDomains: ["reddit.com"],
            source: "reddit.com",
          },
          {
            q: `${org.name} Waterloo`,
            includeDomains: ["uwflow.com"],
            source: "uwflow.com",
          },
          {
            q: `${org.name} Waterloo capstone thesis fourth year project`,
            source: "web",
          },
        ]
      : [
          {
            q: `${org.name} University of Waterloo student club overview history founded`,
            includeDomains: orgDomain ? [orgDomain] : undefined,
            source: orgDomain ?? "web",
          },
          {
            q: `${org.name} University of Waterloo project teams subteams members`,
            source: "web",
          },
          {
            q: `${org.name} University of Waterloo recruitment apply application interview`,
            source: "web",
          },
          {
            q: `${org.name} University of Waterloo time commitment hours per week`,
            source: "web",
          },
          {
            q: `${org.name} University of Waterloo past projects partners sponsors`,
            source: "web",
          },
          {
            q: `${org.name} University of Waterloo`,
            includeDomains: ["reddit.com"],
            source: "reddit.com",
          },
          {
            q: `${org.name} Waterloo`,
            includeDomains: ["medium.com"],
            source: "medium.com",
          },
        ];
  // De-duplicate org-domain query when no website is known
  const phase1Cleaned = phase1.filter(
    (q) => q.q && (q.q.length > 0) && (!q.includeDomains || q.includeDomains.length > 0),
  );

  const seenUrls = new Set<string>();
  const collected: Array<{ url: string; content: string; title?: string; source: string }> = [];

  for (const { q, includeDomains, source } of phase1Cleaned) {
    await emit({ kind: "search", query: q, source });
    const search = await tavilySearch(q, { includeDomains, maxResults: 8 });
    for (const item of search) {
      if (!item.url || !item.content) continue;
      if (seenUrls.has(item.url)) continue;
      const cleaned = stripNoise(item.content);
      if (!isAllowedSnippet(item.url, cleaned)) continue;
      seenUrls.add(item.url);
      collected.push({ url: item.url, content: cleaned, title: item.title, source });
    }
    await emit({ kind: "snippet", count: collected.length });
  }

  // --- Phase 2: LLM-suggested follow-ups based on Phase 1 evidence ---
  await emit({ kind: "phase", label: "Following up on details" });
  const followups = await proposeFollowupQueries(org, collected);
  if (followups.length > 0) {
    await emit({ kind: "followups", queries: followups });
  }
  for (const query of followups.slice(0, 6)) {
    await emit({ kind: "search", query, source: "web" });
    const search = await tavilySearch(query, { maxResults: 6 });
    for (const item of search) {
      if (!item.url || !item.content) continue;
      if (seenUrls.has(item.url)) continue;
      const cleaned = stripNoise(item.content);
      if (!isAllowedSnippet(item.url, cleaned)) continue;
      seenUrls.add(item.url);
      collected.push({ url: item.url, content: cleaned, title: item.title, source: "web" });
    }
    await emit({ kind: "snippet", count: collected.length });
  }

  // --- Bucket snippets by canonical section + an "Other" catch-all ---
  type BucketSnippet = { url: string; content: string; source: string; title?: string };
  const sectionTitles = getSectionTitles(org.category);
  const sectionBuckets = new Map<string, BucketSnippet[]>();
  for (const title of sectionTitles) sectionBuckets.set(title, []);
  const otherBucket: BucketSnippet[] = [];

  // Only snippets that actually mention the org go into topic buckets.
  // Snippets that don't mention the org fall through to Overview seed only if
  // they're substantial and look reasonably on-topic.
  const orgMentions = (text: string) => {
    const lower = text.toLowerCase();
    return org.name
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3)
      .some((t) => lower.includes(t));
  };

  for (const snippet of collected) {
    const matched = matchSections(snippet.content, org.name, org.category);
    const mentions = orgMentions(snippet.content);
    if (matched.length === 0) {
      // Don't seed Overview with random UW pages that don't mention the org —
      // those are noise. Only keep org-mentioning snippets in Overview.
      if (mentions) {
        sectionBuckets.get("Overview")!.push(snippet);
        if (snippet.content.length > 200) otherBucket.push(snippet);
      }
    } else {
      for (const m of matched) {
        // matchSections only returns labels valid for this category, but guard
        // anyway against any future drift.
        const bucket = sectionBuckets.get(m);
        if (bucket) bucket.push(snippet);
      }
      // Also pool org-mentioning snippets in Overview as a baseline
      if (mentions) sectionBuckets.get("Overview")!.push(snippet);
    }
  }

  const titlesFor = (bucket: BucketSnippet[]): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const s of bucket) {
      if (s.title && !map[s.url]) map[s.url] = s.title;
    }
    return map;
  };

  const results: ResearchResult[] = [];
  for (const section of sectionTitles) {
    const bucket = sectionBuckets.get(section)!;
    const trimmed = bucket
      .slice(0, 6)
      .map((s) => `[${s.source}] ${s.content.slice(0, 900)}`)
      .join(" \n\n ");
    results.push({
      section,
      status: trimmed ? "completed" : "skipped",
      sources: bucket.slice(0, 6).map((s) => s.url),
      summary: trimmed || fallbackSectionText(org, section),
      sourceTitles: titlesFor(bucket.slice(0, 6)),
    });
  }
  if (otherBucket.length > 0) {
    const trimmed = otherBucket
      .slice(0, 4)
      .map((s) => `[${s.source}] ${s.content.slice(0, 900)}`)
      .join(" \n\n ");
    results.push({
      section: "Other",
      status: "completed",
      sources: otherBucket.slice(0, 4).map((s) => s.url),
      summary: trimmed,
      sourceTitles: titlesFor(otherBucket.slice(0, 4)),
    });
  }
  return results;
}

async function proposeFollowupQueries(
  org: OrgMetadataInput,
  collected: Array<{ url: string; content: string; source: string }>,
): Promise<string[]> {
  if (collected.length === 0) return [];
  // Send 16 snippets at 1000 chars each — doubling from the original 12×500
  // so named entities buried past char 500 are visible to the query generator.
  // Cost impact: ~2000 extra Gemini tokens (~$0.001), no extra Tavily queries.
  const packet = collected
    .slice(0, 16)
    .map((s, i) => `(${i + 1}) [${s.source}] ${s.content.slice(0, 1000)}`)
    .join("\n\n");
  try {
    const { object } = await generateObject({
      model: openrouter.chat("google/gemini-2.5-flash"),
      schema: z.object({
        queries: z.array(z.string().min(4).max(160)).max(6),
      }),
      system: FOLLOWUP_SYSTEM,
      prompt: `Organization: ${org.name}
Category: ${org.category}

First-pass evidence:
${packet}

Emit 4-6 highly specific follow-up search queries that would surface concrete facts (years, places, partner names, project names, competition placements). Return an empty array if no specific entities can be identified.`,
      maxOutputTokens: 800,
      temperature: 0.4,
    });
    return (object.queries ?? []).filter((q) => q.trim().length > 0);
  } catch (error) {
    logServerError("cold-start.followups", error);
    return [];
  }
}

function matchSections(
  content: string,
  orgName?: string,
  category?: OrgCategory | string,
): string[] {
  const lower = content.toLowerCase();
  // Only bucket a snippet into a topic section if it actually mentions the org
  // by name (or one of its name tokens). Otherwise generic UW pages — "online
  // interviews", "co-op rights", "civil engineering student life" — get
  // mis-bucketed and the LLM either has to ignore them (good) or accidentally
  // includes them as facts (bad).
  const nameTokens = (orgName ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const mentionsOrg =
    nameTokens.length === 0
      ? true
      : nameTokens.some((t) => lower.includes(t));

  const out: string[] = [];
  if (!mentionsOrg) return out;

  // ---- Academic Programs: degree-shaped sections ----
  if (isProgramCategory(category)) {
    if (/(curriculum|required course|core course|elective|prereq|prerequisite|capstone|thesis|stream|specialization|option|major|minor|course code|cs\s*\d|ece\s*\d|math\s*\d|stat\s*\d|se\s*\d|mte\s*\d|syde\s*\d)/.test(lower)) {
      out.push("Curriculum");
    }
    if (/(co.?op|co\.?op|work term|study term|internship|employer|hired|salary|wage|new grad|placement|career outcome|job title|industry partner)/.test(lower)) {
      out.push("Co-op & Career");
    }
    if (/(admission|admit|cutoff|admission average|aif|admission information form|deadline|application|supplementary|prerequisite|grade 12|secondary school)/.test(lower)) {
      out.push("Admissions");
    }
    if (/(culture|workload|community|vibe|student life|reddit|r\/uwaterloo|uwflow|chill|intense|grind|social|inclusive|welcoming|gender ratio|cohort|atmosphere|stress)/.test(lower)) {
      out.push("Culture");
    }
    if (/(uwaterloo\.ca|ucalendar\.uwaterloo|findoutmore\.uwaterloo|magazine\.uwaterloo|undergraduate office|advisor|advising|official program|course calendar|uwflow\.com)/.test(lower)) {
      out.push("Resources");
    }
    return out;
  }

  // ---- Clubs / design teams / societies: original section set ----
  if (/(time commitment|hours per week|hours\/week|\d+\s*hours|full.time|part.time|commitment level|workload|evenings|weekends|per term)/.test(lower)) {
    out.push("Time Commitment");
  }
  if (/(culture|values|vibe|social|retreat|community|collaborative|inclusive|welcoming|intense|competitive|supportive|mentor|environment|atmosphere)/.test(lower)) {
    out.push("Culture and Vibe");
  }
  if (/(subteam|sub-team|project team|developer|designer|product manager|technical lead|director|\bvp\b|captain|mechanical|electrical|business team|coordinator|officer|treasurer|secretary|software engineer|hardware|firmware)/.test(lower)) {
    out.push("Subteams and Roles");
  }
  if (/(past project|partnered|partner|sponsor|nonprofit|previously worked|case study|client|competition|world solar|american solar|solar car|race result|placed \d|finished \d|\bwon\b|award|hackathon|bootcamp|workshop series|finalist|recognized|achieved|\bbuilt\b|\bcreated\b|\bdeployed\b|\blaunched\b|showcase|demo day)/.test(lower)) {
    out.push("Past Projects");
  }
  if (/(president|founder|founded in|founded \d|founded by|co-founder|history|leadership|alumni|team captain|established|started|created in|milestone|achievement|inception|inaugural)/.test(lower)) {
    out.push("History");
  }
  if (/(apply|application|recruitment|how to join|join the team|interview process|hiring members|sign up|onboarding|eligibility|selection|intake|requirements|deadline|open to all|open membership|how to get involved)/.test(lower)) {
    out.push("How to Apply");
  }
  if (/(linkedin\.com|instagram\.com|github\.com|medium\.com|twitter\.com|youtube\.com|discord\.gg|discord\.com|linktree\.com|tiktok\.com|official website|@\w+)/.test(lower)) {
    out.push("External Links");
  }
  return out;
}

/**
 * Collect a de-duplicated set of URLs that plausibly belong to the org
 * (its own domain, its social profiles, its GitHub, its Medium page).
 * These are passed explicitly to the synthesis prompt so the External Links
 * section has real hrefs to work with instead of bare "Official Website" text.
 */
function extractOrgUrls(
  org: OrgMetadataInput,
  research: ResearchResult[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (url: string) => {
    const clean = url.trim();
    if (!clean.startsWith("http") || seen.has(clean)) return;
    seen.add(clean);
    result.push(clean);
  };

  // Official website from metadata (highest priority)
  if (org.website) add(org.website);

  const orgDomain = deriveDomain(org.website);
  const nameSlug = org.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Match on first 5 chars of slug OR a trailing 4-char suffix to catch
  // abbreviated handles (e.g. "uwdsc" for "UW Data Science Club" → slug "uwdatascienceclub")
  const slugPrefix = nameSlug.slice(0, 5);
  const slugSuffix = nameSlug.length >= 4 ? nameSlug.slice(-4) : "";
  const matchesOrgSlug = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes(slugPrefix) || (slugSuffix && lower.includes(slugSuffix));
  };

  // Scan all source URLs collected during research
  for (const item of research) {
    for (const url of item.sources) {
      const domain = deriveDomain(url);
      if (!domain) continue;
      const lower = url.toLowerCase();

      // Always include org's own domain
      const isOwnDomain = orgDomain && domain === orgDomain;

      // Instagram — must mention org slug
      const isInstagram = lower.includes("instagram.com") && matchesOrgSlug(url);

      // LinkedIn — /company/ or /school/ paths, must mention slug
      const isLinkedin =
        (lower.includes("linkedin.com/company/") || lower.includes("linkedin.com/school/")) &&
        matchesOrgSlug(url);

      // GitHub — org page (github.com/ORG with no extra path segments), must match slug
      const isGithub =
        lower.includes("github.com") &&
        // Reject deep repo URLs like github.com/ORG/REPO/blob/...
        url.replace(/^https?:\/\/github\.com\//, "").split("/").filter(Boolean).length <= 1 &&
        matchesOrgSlug(url);

      // Medium — author profile (@handle) OR named publication (medium.com/pubname)
      const isMedium =
        lower.includes("medium.com") &&
        (lower.includes("medium.com/@") || /medium\.com\/[^@/][^/]*$/.test(lower)) &&
        matchesOrgSlug(url);

      // Linktree — must mention slug
      const isLinktree = lower.includes("linktr.ee") || lower.includes("linktree.com");

      // Twitter/X — must mention slug
      const isTwitter =
        (lower.includes("twitter.com") || lower.includes("x.com")) &&
        matchesOrgSlug(url);

      // YouTube — channel page, must mention slug
      const isYoutube =
        lower.includes("youtube.com") &&
        (lower.includes("/channel/") || lower.includes("/c/") || lower.includes("/@")) &&
        matchesOrgSlug(url);

      if (isOwnDomain || isInstagram || isLinkedin || isGithub || isMedium || isLinktree || isTwitter || isYoutube) {
        add(url);
      }
    }
  }

  return result.slice(0, 10); // cap so prompt doesn't balloon
}

async function synthesizeDraftWithLLM(
  org: OrgMetadataInput,
  research: ResearchResult[],
): Promise<ProseMirrorDoc> {
  // Build a global, deduped URL pool. Each unique URL gets a numeric refId
  // that the LLM will use to cite claims back to a source.
  const urlPool = buildUrlPool(research);
  const urlToInputRefId = new Map<string, number>();
  urlPool.forEach((entry, i) => urlToInputRefId.set(entry.url, i + 1));

  // For each section, the list of refIds whose evidence appears in that
  // section's bucket. The LLM is told to cite only from this subset.
  const sectionRefIds = new Map<string, number[]>();
  for (const item of research) {
    const ids: number[] = [];
    for (const url of item.sources) {
      const id = urlToInputRefId.get(url);
      if (id && !ids.includes(id)) ids.push(id);
    }
    sectionRefIds.set(item.section, ids);
  }

  const knownUrls = extractOrgUrls(org, research);
  const linkSectionLabel = isProgramCategory(org.category)
    ? "Resources"
    : "External Links";
  const urlHint =
    knownUrls.length > 0
      ? `\nKnown URLs for this org (use these for ${linkSectionLabel}):\n${knownUrls.map((u) => `- ${u}`).join("\n")}`
      : "";

  const sourcePoolBlock = urlPool.length
    ? urlPool
        .map(
          (entry, i) =>
            `[${i + 1}] ${entry.title ? `${entry.title} — ` : ""}${entry.url}`,
        )
        .join("\n")
    : "(no sources)";

  const evidence = research
    .filter((item) => item.summary && item.summary.length > 60)
    .map((item) => {
      const ids = sectionRefIds.get(item.section) ?? [];
      const trimmed = item.summary.slice(0, 3500);
      return `### Candidate section: ${item.section}\nrefIds available for this section: [${ids.join(", ") || "—"}]\nNotes: ${trimmed}`;
    })
    .join("\n\n");

  const userPrompt = `Organization: ${org.name}
Category: ${org.category}
One-liner: ${org.oneLiner ?? "(none)"}
Official website: ${org.website ?? "(none)"}${urlHint}

Source pool (cite these refIds):
${sourcePoolBlock}

Write a neutral, third-person Wikipedia-style article. Every factual sentence must cite at least one refId from the section's available pool. Be ruthless: discard evidence that isn't clearly about ${org.name}.

Sections to consider (omit any that lack real evidence — list dropped titles in droppedSections):
${getSectionTitles(org.category).map((t) => `- ${t}`).join("\n")}

Evidence:

${evidence || "(no usable evidence)"}`;

  const blockSchema = z.object({
    kind: z.enum(["paragraph", "bulletList", "linkList"]),
    sentences: z
      .array(
        z.object({
          text: z.string().min(1).max(800),
          citations: z.array(z.number().int().positive()).max(6).default([]),
        }),
      )
      .max(20)
      .optional(),
    items: z
      .array(
        z.object({
          text: z.string().min(1).max(400),
          citations: z.array(z.number().int().positive()).max(6).default([]),
        }),
      )
      .max(30)
      .optional(),
    links: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          url: z.string().min(4).max(500),
        }),
      )
      .max(20)
      .optional(),
  });

  let synthesized: SynthesizedDraft | null = null;
  let lastError: unknown = null;
  try {
    const { object } = await generateObject({
      model: openrouter.chat("google/gemini-2.5-flash"),
      schema: z.object({
        sections: z.array(
          z.object({
            title: z.string().min(1).max(120),
            blocks: z.array(blockSchema).min(1).max(20),
          }),
        ),
        droppedSections: z.array(z.string()),
      }),
      system: isProgramCategory(org.category)
        ? PROGRAM_SYNTHESIS_SYSTEM
        : COLD_START_SYNTHESIS_SYSTEM,
      prompt: userPrompt,
      maxOutputTokens: 12000,
      temperature: 0.3,
    });
    synthesized = object as SynthesizedDraft;
  } catch (error) {
    lastError = error;
    logSynthesisError(error, {
      org: org.name,
      urlPoolSize: urlPool.length,
      promptChars: userPrompt.length,
    });
  }

  if (!synthesized) {
    // lastError was already logged in detail via logSynthesisError above.
    throw new ColdStartSynthesisError();
  }
  if (synthesized.sections.length === 0) {
    console.error(
      JSON.stringify({
        scope: "cold-start.synthesize.empty",
        reason: "llm-returned-zero-sections",
        droppedSections: synthesized.droppedSections ?? [],
        org: org.name,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new ColdStartSynthesisError();
  }

  // Renumber: only refIds that the LLM actually cited get a final refId in the
  // References section, numbered 1..M in order of first appearance.
  const inputToFinalRefId = new Map<number, number>();
  for (const section of synthesized.sections) {
    for (const block of section.blocks) {
      const fragments = blockFragments(block);
      for (const frag of fragments) {
        for (const inputId of frag.citations) {
          if (!urlPool[inputId - 1]) continue; // unknown id — skip
          if (!inputToFinalRefId.has(inputId)) {
            inputToFinalRefId.set(inputId, inputToFinalRefId.size + 1);
          }
        }
      }
    }
  }

  const references: ReferenceEntry[] = [];
  for (const [inputId, finalId] of inputToFinalRefId.entries()) {
    const entry = urlPool[inputId - 1];
    if (!entry) continue;
    references.push({
      refId: finalId,
      url: entry.url,
      title: entry.title || deriveDomain(entry.url) || entry.url,
    });
  }
  references.sort((a, b) => a.refId - b.refId);

  const docContent: ProseMirrorNode[] = [];
  for (const section of synthesized.sections) {
    const heading: ProseMirrorNode = {
      type: "heading",
      attrs: { level: 2, slug: slugify(section.title) },
      content: [{ type: "text", text: section.title }],
    };
    const body: ProseMirrorNode[] = [];
    for (const block of section.blocks) {
      const built = blockToProseMirror(block, inputToFinalRefId);
      if (built) body.push(built);
    }
    if (body.length === 0) continue;
    docContent.push(heading, ...body);
  }

  if (docContent.length === 0) {
    console.error(
      JSON.stringify({
        scope: "cold-start.synthesize.empty",
        reason: "all-sections-assembled-empty",
        org: org.name,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new ColdStartSynthesisError();
  }

  if (references.length > 0) {
    docContent.push(
      {
        type: "heading",
        attrs: { level: 2, slug: "references" },
        content: [{ type: "text", text: "References" }],
      },
      referencesListNode(references),
    );
  }

  const doc: ProseMirrorDoc = {
    type: "doc",
    content: docContent,
  } as ProseMirrorDoc;

  const validation = validateProposalDoc(doc);
  if (!validation.ok) {
    console.error(
      JSON.stringify({
        scope: "cold-start.synthesize.validate",
        reason: "doc-validation-failed",
        error: validation.error,
        org: org.name,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new ColdStartSynthesisError();
  }
  return doc;
}

/**
 * Thrown when cold-start synthesis fails. Carries no details — diagnostic
 * information is written to server logs only. The thrown message is the only
 * thing surfaced to the admin UI / streaming client.
 */
class ColdStartSynthesisError extends Error {
  constructor() {
    super("Cold-start synthesis failed. Please try again.");
    this.name = "ColdStartSynthesisError";
  }
}

function buildUrlPool(
  research: ResearchResult[],
): Array<{ url: string; title: string }> {
  const seen = new Map<string, { url: string; title: string }>();
  for (const item of research) {
    for (const url of item.sources) {
      if (!url || seen.has(url)) continue;
      const title = item.sourceTitles?.[url] ?? "";
      seen.set(url, { url, title });
    }
  }
  return [...seen.values()];
}

function blockFragments(block: SynthesizedBlock): CitedFragment[] {
  if (block.kind === "paragraph") return block.sentences ?? [];
  if (block.kind === "bulletList") return block.items ?? [];
  return [];
}

function blockToProseMirror(
  block: SynthesizedBlock,
  refMap: Map<number, number>,
): ProseMirrorNode | null {
  if (block.kind === "paragraph") {
    const sentences = block.sentences ?? [];
    if (sentences.length === 0) return null;
    const inline: ProseMirrorNode[] = [];
    sentences.forEach((s, i) => {
      const text = i === 0 ? s.text : ` ${s.text}`;
      inline.push({ type: "text", text });
      for (const citation of citationNodes(s.citations, refMap)) {
        inline.push(citation);
      }
    });
    if (inline.length === 0) return null;
    return { type: "paragraph", content: inline };
  }
  if (block.kind === "bulletList") {
    const items = block.items ?? [];
    if (items.length === 0) return null;
    const listItems: ProseMirrorNode[] = items.map((item) => {
      const inline: ProseMirrorNode[] = [{ type: "text", text: item.text }];
      for (const citation of citationNodes(item.citations, refMap)) {
        inline.push(citation);
      }
      return {
        type: "listItem",
        content: [{ type: "paragraph", content: inline }],
      };
    });
    return { type: "bulletList", content: listItems };
  }
  if (block.kind === "linkList") {
    const links = block.links ?? [];
    if (links.length === 0) return null;
    const listItems: ProseMirrorNode[] = [];
    for (const link of links) {
      if (!isSafeHttpUrl(link.url)) continue;
      listItems.push({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: link.label,
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: link.url,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    }
    if (listItems.length === 0) return null;
    return { type: "bulletList", content: listItems };
  }
  return null;
}

function citationNodes(
  citations: number[],
  refMap: Map<number, number>,
): ProseMirrorNode[] {
  const out: ProseMirrorNode[] = [];
  const seen = new Set<number>();
  for (const id of citations) {
    const finalId = refMap.get(id);
    if (!finalId || seen.has(finalId)) continue;
    seen.add(finalId);
    out.push({ type: "citation", attrs: { refId: finalId } });
  }
  return out;
}

function referencesListNode(refs: ReferenceEntry[]): ProseMirrorNode {
  return {
    type: "bulletList",
    content: refs.map((ref) => ({
      type: "listItem",
      attrs: { refId: ref.refId },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `[${ref.refId}] ${ref.title} — ` },
            {
              type: "text",
              text: ref.url,
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: ref.url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  },
                },
              ],
            },
          ],
        },
      ],
    })),
  };
}

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url);
}

function logSynthesisError(
  error: unknown,
  context: { org: string; urlPoolSize: number; promptChars: number },
): void {
  const err = error as
    | (Error & {
        cause?: unknown;
        responseBody?: unknown;
        text?: unknown;
        statusCode?: unknown;
        url?: unknown;
        value?: unknown;
      })
    | undefined;
  const payload = {
    scope: "cold-start.synthesize",
    org: context.org,
    urlPoolSize: context.urlPoolSize,
    promptChars: context.promptChars,
    name: err?.name,
    message: err?.message ?? String(error),
    statusCode: err?.statusCode,
    url: typeof err?.url === "string" ? err.url : undefined,
    responseBody:
      typeof err?.responseBody === "string"
        ? err.responseBody.slice(0, 2000)
        : undefined,
    text: typeof err?.text === "string" ? err.text.slice(0, 2000) : undefined,
    value: (() => {
      try {
        return err?.value !== undefined
          ? JSON.stringify(err.value).slice(0, 2000)
          : undefined;
      } catch {
        return undefined;
      }
    })(),
    cause:
      err?.cause instanceof Error
        ? `${err.cause.name}: ${err.cause.message}`
        : err?.cause !== undefined
          ? String(err.cause).slice(0, 500)
          : undefined,
    stack: err?.stack,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}

function estimatePulse(
  org: OrgMetadataInput,
  research: ResearchResult[],
):
  | { selectivity: string | null; vibeCheck: null; coopBoost: null }
  | { workload: null; employability: null; community: null } {
  // Academic Programs use a separate metric set (workload / employability /
  // community). These are inherently subjective and don't have a defensible
  // text-heuristic estimator, so we seed nothing — the metrics surface as
  // "No ratings yet" until real users vote.
  if (isProgramCategory(org.category)) {
    return { workload: null, employability: null, community: null };
  }
  const text = research.map((item) => item.summary).join(" ");
  const selectivity = /application|apply|interview/i.test(text)
    ? "Application-Based"
    : /invite/i.test(text)
      ? "Invite-Only"
      : "Open Membership";
  return {
    selectivity,
    vibeCheck: null,
    coopBoost: null,
  };
}

async function seedPulseAggregates(orgId: string, estimates: Record<string, unknown>) {
  const client = createAdminClient();
  const rows = [];
  // Only the club-style categorical `selectivity` guess is durable enough to
  // seed without a real user vote. Numeric metrics (vibe/co-op, and the new
  // workload/employability/community for programs) require actual votes.
  if (typeof estimates.selectivity === "string") {
    rows.push({
      org_id: orgId,
      metric: "selectivity",
      aggregate_value: estimates.selectivity,
      aggregate_label: estimates.selectivity,
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
    return org.website ? `- [${org.name} Website](${org.website})` : "";
  }
  if (section === "Past Projects") {
    return `Specific past events and projects for ${org.name} have not been publicly documented.`;
  }
  if (section === "History") {
    return `The founding history and milestones of ${org.name} have not been publicly documented.`;
  }
  return `No reliable public information found for ${section.toLowerCase()} yet.`;
}

