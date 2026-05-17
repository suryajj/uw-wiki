import { tool } from "ai";
import { z } from "zod";

import { searchWikiTool } from "@/lib/ai/rag";
import {
  extractPlainText,
  extractSections,
} from "@/lib/prosemirror/sections";
import { slugify } from "@/lib/utils/slug";
import { eq, inList, supabaseRest } from "@/lib/supabase/rest";
import {
  ORG_CATEGORIES,
  PULSE_METRICS,
  type ProseMirrorDoc,
  type PulseMetric,
} from "@/types/domain";

// Cap the article body we hand back to the model. Generous enough for any
// realistic UW page; small enough that a multi-org compare still fits inside
// the model's context window.
const MAX_BODY_CHARS = 12000;

type PulseAggregateRow = {
  metric: PulseMetric;
  aggregate_value: string;
  aggregate_label: string;
  total_votes: number;
};

type OrgWithPulseRow = {
  org_slug: string;
  org_name: string;
  category: string;
  claimed_status?: string | null;
  pages?: { last_modified_at: string | null } | null;
  pulse_aggregates?: PulseAggregateRow[] | null;
};

type RankedPulseRow = {
  aggregate_value: string;
  aggregate_label: string;
  total_votes: number;
  organizations: {
    org_name: string;
    org_slug: string;
    category: string;
  };
};

type OrgListRow = {
  org_name: string;
  org_slug: string;
  category: string;
  pages?: { last_modified_at: string | null } | null;
};

export const getOrgDataTool = tool({
  description:
    "Fetch structured data about one or more UW organizations: Pulse ratings, org category, and page health. Always call this for any named org mentioned in the query; combine with search_wiki for opinions or experiences.",
  inputSchema: z.object({
    orgs: z
      .array(
        z
          .object({
            slug: z.string().optional(),
            name: z.string().optional(),
          })
          .refine((org) => org.slug || org.name, {
            message: "Each org entry must have either a slug or a name",
          }),
      )
      .min(1)
      .max(5),
  }),
  execute: async ({ orgs }) => {
    const resolvedSlugs: string[] = [];
    const unresolvedNames: string[] = [];

    for (const org of orgs) {
      if (org.slug) {
        resolvedSlugs.push(org.slug);
        continue;
      }

      if (!org.name) continue;
      // Tightened resolution: previously this was a single `ilike '%name%'`
      // and the first hit won — that's how "Watonomous" silently became
      // "Midnight Sun" in the wild. New order:
      //   1) exact slug == slugify(name)
      //   2) exact case-insensitive org_name match
      //   3) ilike but ranked by Levenshtein distance, accepted only when the
      //      top candidate is unambiguously close (distance ≤ 3 OR the query
      //      appears as a full word inside the candidate name)
      const resolvedSlug = await resolveOrgName(org.name);
      if (resolvedSlug) resolvedSlugs.push(resolvedSlug);
      else unresolvedNames.push(org.name);
    }

    if (resolvedSlugs.length === 0) {
      return {
        found: false,
        unresolvedNames,
        message:
          "Could not resolve org name(s). Call search_wiki with the org name as a keyword query to find matching pages and the correct slug.",
      };
    }

    const select = encodeURIComponent(
      "org_slug,org_name,category,claimed_status,pages(last_modified_at),pulse_aggregates(metric,aggregate_value,aggregate_label,total_votes)",
    );
    const rows = await supabaseRest<OrgWithPulseRow[]>(
      `/organizations?select=${select}&org_slug=${inList(resolvedSlugs)}`,
    );

    if (rows.length === 0) {
      return {
        found: false,
        message: `No organizations found for slug(s): ${resolvedSlugs.join(", ")}.`,
      };
    }

    return {
      found: true,
      orgs: rows.map(formatOrgData),
    };
  },
});

export const listOrgsTool = tool({
  description:
    "List UW organizations ranked by a Pulse metric, or filtered by category. Use this for discovery and ranking questions across many orgs. Do not use for questions about a specific named org; use get_org_data for those.",
  inputSchema: z.object({
    metric: z.enum(PULSE_METRICS).optional(),
    order: z.enum(["desc", "asc"]).default("desc"),
    category: z.enum(ORG_CATEGORIES).optional(),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  execute: async ({ metric, order, category, limit }) => {
    if (metric) {
      const select = encodeURIComponent(
        "aggregate_value,aggregate_label,total_votes,organizations!inner(org_name,org_slug,category)",
      );
      const categoryFilter = category
        ? `&organizations.category=${eq(category)}`
        : "";
      // Pull all candidates (the table is small) and sort in app code so
      // numeric metrics aren't compared lexicographically — FRD-1 §13 #25.
      const rows = await supabaseRest<RankedPulseRow[]>(
        `/pulse_aggregates?select=${select}&metric=${eq(metric)}&total_votes=gte.3${categoryFilter}`,
      );

      if (rows.length === 0) {
        return {
          found: false,
          message: `No orgs found with sufficient votes for metric '${metric}'${category ? ` in category '${category}'` : ""}.`,
        };
      }

      const sorted = sortRankedRows(rows, metric, order).slice(0, limit);

      return {
        found: true,
        metric,
        order,
        orgs: sorted.map((row) => ({
          orgName: row.organizations.org_name,
          orgSlug: row.organizations.org_slug,
          category: row.organizations.category,
          value: row.aggregate_value,
          label: row.aggregate_label,
          totalVotes: row.total_votes,
        })),
      };
    }

    const select = encodeURIComponent("org_name,org_slug,category,pages(last_modified_at)");
    const categoryFilter = category ? `&category=${eq(category)}` : "";
    const rows = await supabaseRest<OrgListRow[]>(
      `/organizations?select=${select}${categoryFilter}&order=org_name.asc&limit=${limit}`,
    );

    if (rows.length === 0) {
      return {
        found: false,
        message: `No orgs found${category ? ` in category '${category}'` : ""}.`,
      };
    }

    return {
      found: true,
      metric: metric ?? null,
      orgs: rows.map((row) => ({
        orgName: row.org_name,
        orgSlug: row.org_slug,
        category: row.category,
        lastModifiedAt: row.pages?.last_modified_at ?? null,
      })),
    };
  },
});

const SELECTIVITY_RANK: Record<string, number> = {
  // Higher rank = "more selective". Used so `order: desc` (most selective
  // first) and `order: asc` (most open first) both behave per FRD-1 §5.2c.
  "Invite-Only": 3,
  "Application-Based": 2,
  "Open Membership": 1,
};

function sortRankedRows(
  rows: RankedPulseRow[],
  metric: PulseMetric,
  order: "asc" | "desc",
): RankedPulseRow[] {
  const direction = order === "asc" ? 1 : -1;
  const cloned = [...rows];
  if (metric === "selectivity") {
    cloned.sort((a, b) => {
      const left = SELECTIVITY_RANK[a.aggregate_value] ?? 0;
      const right = SELECTIVITY_RANK[b.aggregate_value] ?? 0;
      return (left - right) * direction;
    });
    return cloned;
  }
  cloned.sort((a, b) => {
    const left = Number.parseFloat(a.aggregate_value);
    const right = Number.parseFloat(b.aggregate_value);
    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return (left - right) * direction;
  });
  return cloned;
}

type PageContentRow = {
  slug: string;
  current_version_id: string | null;
  last_modified_at: string | null;
  content_json: ProseMirrorDoc | null;
  organizations:
    | { org_name: string; org_slug: string; category: string }
    | Array<{ org_name: string; org_slug: string; category: string }>
    | null;
};

type VersionRow = { content_json: ProseMirrorDoc | null };

export const getPageContentTool = tool({
  description:
    "Fetch the full article body (all sections, in order) for a single org page. Use this whenever the user asks for any narrative, opinion, or specific detail about a named org — Pulse metrics alone are NOT an article. Call get_org_data first to resolve the slug, then call this tool with that slug.",
  inputSchema: z.object({
    slug: z
      .string()
      .min(1)
      .describe("The org/page slug (e.g. 'uw-blueprint', 'watonomous')."),
  }),
  execute: async ({ slug }) => {
    const select = encodeURIComponent(
      "slug,current_version_id,last_modified_at,content_json,organizations(org_name,org_slug,category)",
    );
    const rows = await supabaseRest<PageContentRow[]>(
      `/pages?select=${select}&slug=${eq(slug)}&limit=1`,
    );
    const row = rows[0];
    if (!row) {
      return {
        found: false,
        message: `No page found for slug '${slug}'. Try list_orgs or search_wiki with the org name.`,
      };
    }

    // Prefer the current published version (page_versions.content_json); fall
    // back to the page mirror only if the FK is null.
    let doc: ProseMirrorDoc | null = null;
    if (row.current_version_id) {
      const versionRows = await supabaseRest<VersionRow[]>(
        `/page_versions?select=content_json&id=${eq(row.current_version_id)}&limit=1`,
      );
      doc = versionRows[0]?.content_json ?? null;
    }
    if (!doc) doc = row.content_json;
    if (!doc) {
      return {
        found: false,
        message: `Page '${slug}' has no published content yet.`,
      };
    }

    const org = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;

    const sections = extractSections(doc).map((section) => ({
      title: section.title,
      slug: section.slug,
      body: extractPlainText({ type: "doc", content: section.body }).trim(),
    }));

    // Soft-truncate body across all sections so a single massive page doesn't
    // crowd the model's context window when comparing multiple orgs.
    let total = 0;
    const trimmedSections = sections.map((section) => {
      if (total >= MAX_BODY_CHARS) return { ...section, body: "" };
      const remaining = MAX_BODY_CHARS - total;
      const body =
        section.body.length > remaining
          ? `${section.body.slice(0, remaining)}…`
          : section.body;
      total += body.length;
      return { ...section, body };
    });

    return {
      found: true,
      slug: row.slug,
      orgName: org?.org_name ?? slug,
      orgSlug: org?.org_slug ?? slug,
      category: org?.category ?? null,
      lastModifiedAt: row.last_modified_at,
      sections: trimmedSections,
    };
  },
});

export const ragTools = {
  search_wiki: searchWikiTool,
  get_org_data: getOrgDataTool,
  get_page_content: getPageContentTool,
  list_orgs: listOrgsTool,
};

// --- name resolution helpers -------------------------------------------------

async function resolveOrgName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const target = slugify(trimmed);

  // 1) Exact slug match — the cheapest and most precise lookup.
  if (target) {
    const slugMatches = await supabaseRest<Array<{ org_slug: string }>>(
      `/organizations?select=org_slug&org_slug=${eq(target)}&limit=1`,
    );
    if (slugMatches[0]?.org_slug) return slugMatches[0].org_slug;
  }

  // 2) Exact case-insensitive name match.
  const nameMatches = await supabaseRest<Array<{ org_slug: string; org_name: string }>>(
    `/organizations?select=org_slug,org_name&org_name=ilike.${encodeURIComponent(trimmed)}&limit=1`,
  );
  if (nameMatches[0]?.org_slug) return nameMatches[0].org_slug;

  // 3) Fuzzy match — pull top candidates with ilike '%name%', then accept the
  //    closest one only if it's unambiguously close. Otherwise refuse and let
  //    the model ask the user for clarification.
  const fuzzyMatches = await supabaseRest<Array<{ org_slug: string; org_name: string }>>(
    `/organizations?select=org_slug,org_name&org_name=ilike.${encodeURIComponent(
      `%${trimmed}%`,
    )}&limit=10`,
  );
  if (fuzzyMatches.length === 0) return null;

  const queryLower = trimmed.toLowerCase();
  const ranked = fuzzyMatches
    .map((row) => ({
      ...row,
      distance: levenshtein(queryLower, row.org_name.toLowerCase()),
      containsAsToken: containsAsToken(row.org_name.toLowerCase(), queryLower),
    }))
    .sort((a, b) => a.distance - b.distance);

  const top = ranked[0];
  // Accept the top hit only when it's clearly the right org. The "contains
  // as a whole token" guard catches cases like asking for "blueprint" and
  // matching "UW Blueprint" cleanly.
  if (top.distance <= 3 || top.containsAsToken) return top.org_slug;
  return null;
}

function containsAsToken(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(haystack);
}

// Iterative Levenshtein — small alphabet, short strings, no need for a lib.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1).fill(0);
  const curr = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function formatOrgData(row: OrgWithPulseRow) {
  const lastModifiedAt = row.pages?.last_modified_at ?? null;

  const pulse = Object.fromEntries(
    (row.pulse_aggregates ?? []).map((aggregate) => [
      aggregate.metric,
      {
        value: aggregate.aggregate_value,
        label: aggregate.aggregate_label,
        totalVotes: aggregate.total_votes,
      },
    ]),
  );

  return {
    orgName: row.org_name,
    orgSlug: row.org_slug,
    category: row.category,
    claimedStatus: row.claimed_status ?? "unclaimed",
    lastModifiedAt,
    pulse: {
      selectivity: pulse.selectivity ?? null,
      vibeCheck: pulse.vibe_check ?? null,
      coopBoost: pulse.coop_boost ?? null,
    },
  };
}
