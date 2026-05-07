// Stub. Real implementation lands in FRD-1.
// Exports defined here so downstream FRD code can import and compile.

export type OrgMeta = {
  universityId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  category: string;
  pageVersionId?: string;
};

export type CommentData = {
  body: string;
  anchoredSection: string | null;
  createdAt: string;
};

export type ProseMirrorDoc = { type: "doc"; content?: unknown[] };

export async function embedText(_text: string): Promise<number[]> {
  throw new Error("embedText not implemented until FRD-1");
}

export async function embedBatch(_texts: string[]): Promise<number[][]> {
  throw new Error("embedBatch not implemented until FRD-1");
}

export async function reembedPage(
  _pageId: string,
  _orgMeta: OrgMeta,
  _content: ProseMirrorDoc,
): Promise<void> {
  throw new Error("reembedPage not implemented until FRD-1");
}

export async function reembedSections(
  _pageId: string,
  _sectionSlugs: string[],
  _orgMeta: OrgMeta,
  _content: ProseMirrorDoc,
): Promise<void> {
  throw new Error("reembedSections not implemented until FRD-1");
}

export async function reembedComment(
  _commentId: string,
  _orgMeta: OrgMeta,
  _comment: CommentData,
): Promise<void> {
  throw new Error("reembedComment not implemented until FRD-1");
}
