import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";

const SECTIONS: Array<{ title: string; slug: string }> = [
  { title: "Overview", slug: "overview" },
  { title: "Time Commitment", slug: "time-commitment" },
  { title: "Culture and Vibe", slug: "culture-and-vibe" },
  { title: "Subteams and Roles", slug: "subteams-and-roles" },
  { title: "Past Projects", slug: "past-projects" },
  { title: "Exec History", slug: "exec-history" },
  { title: "How to Apply", slug: "how-to-apply" },
  { title: "External Links", slug: "external-links" },
];

const TEMPLATE_CONTENT: ProseMirrorNode[] = SECTIONS.flatMap(
  ({ title, slug }) => [
    {
      type: "heading",
      attrs: { level: 2, slug },
      content: [{ type: "text", text: title }],
    },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
  ],
);

export const SUGGESTED_TEMPLATE: ProseMirrorDoc = {
  type: "doc",
  content: TEMPLATE_CONTENT,
};
