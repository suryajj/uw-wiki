import type { ProseMirrorDoc } from "@/types/domain";

export type EditorDraft = {
  content: ProseMirrorDoc;
  pageVersionId: string;
  savedAt: string;
};

export function draftKey(pageId: string) {
  return `uw-wiki-draft:${pageId}`;
}

export function saveDraft(
  pageId: string,
  content: ProseMirrorDoc,
  pageVersionId: string,
) {
  const draft: EditorDraft = {
    content,
    pageVersionId,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(draftKey(pageId), JSON.stringify(draft));
}

export function loadDraft(
  pageId: string,
  currentVersionId: string,
): EditorDraft | null {
  const raw = localStorage.getItem(draftKey(pageId));
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as EditorDraft;
    if (draft.pageVersionId !== currentVersionId) {
      localStorage.removeItem(draftKey(pageId));
      return null;
    }
    return draft;
  } catch {
    localStorage.removeItem(draftKey(pageId));
    return null;
  }
}

export function clearDraft(pageId: string) {
  localStorage.removeItem(draftKey(pageId));
}
