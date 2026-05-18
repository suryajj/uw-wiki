import {
  InputRule,
  Node,
  PasteRule,
  type Editor,
  mergeAttributes,
} from "@tiptap/core";
import ListItem from "@tiptap/extension-list-item";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";

/**
 * Inline atomic node that renders a Wikipedia-style superscript citation
 * (`[N]`). Read-mode rendering and the cold-start synthesis pipeline both
 * already understand this node shape — this extension adds the *authoring*
 * surfaces (toolbar command, paste rule, input rule) so contributors can
 * insert citations without hand-editing JSON.
 */
export const CitationNode = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      refId: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-ref-id");
          if (!raw) return null;
          const n = Number(raw);
          return Number.isInteger(n) && n >= 1 ? n : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.refId) return {};
          return { "data-ref-id": String(attrs.refId) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-citation]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const refId = Number(node.attrs.refId) || 0;
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-citation": "true",
        class: "ml-0.5 text-[10px] font-medium leading-none text-primary",
      }),
      `[${refId}]`,
    ];
  },

  addCommands() {
    return {
      /** Insert a citation with the caller-supplied refId at the cursor. */
      insertCitation:
        (refId: number) =>
        ({ chain }) => {
          if (!Number.isInteger(refId) || refId < 1) return false;
          return chain()
            .insertContent({ type: "citation", attrs: { refId } })
            .command(({ state, tr }) => {
              safeEnsureReferencePlaceholder(state, tr, refId);
              return true;
            })
            .run();
        },
      /**
       * Insert a citation using the next free refId — i.e. max existing
       * refId + 1 across the whole document (body + references list).
       * Used by the toolbar "Insert citation" button.
       */
      insertNextCitation:
        () =>
        ({ chain, editor }) => {
          const refId = nextAvailableRefId(editor);
          return chain()
            .insertContent({ type: "citation", attrs: { refId } })
            .command(({ state, tr }) => {
              safeEnsureReferencePlaceholder(state, tr, refId);
              return true;
            })
            .run();
        },
    };
  },

  /**
   * Pasted text → citation nodes. Catches ASCII `[N]` runs in the article
   * body. The rule's `find` regex matches each `[N]` independently, so
   * pasting "interdisciplinary program.[1][2]" yields two adjacent
   * citation nodes around the period.
   *
   * We use the raw `PasteRule` constructor (not `nodePasteRule`) so the
   * handler can inspect `state` + `range` to skip conversion when the
   * paste destination is inside a reference list item. Without this
   * guard, pasting refresh-text into the bibliography would clobber the
   * literal `[N]` label that anchors each entry.
   */
  addPasteRules() {
    const nodeType = this.type;
    return [
      new PasteRule({
        find: /\[(\d+)\]/g,
        handler: ({ state, range, match, chain }) => {
          if (isInsideReferenceListItem(state.doc, range.from)) return null;
          const refId = Number(match[1]);
          if (!Number.isInteger(refId) || refId < 1) return null;
          chain()
            .deleteRange({ from: range.from, to: range.to })
            .insertContentAt(range.from, {
              type: nodeType.name,
              attrs: { refId },
            })
            .command(({ state: s, tr }) => {
              safeEnsureReferencePlaceholder(s, tr, refId);
              return true;
            })
            .run();
        },
      }),
    ];
  },

  /**
   * Inline-typing → citation node. When the user types `[3] ` (or `[3].`,
   * `[3];`, etc.), the bracket sequence converts to a citation node and
   * the terminator character is re-inserted so the user's typing isn't
   * disrupted.
   *
   * Implemented with a raw `InputRule` (rather than `nodeInputRule`)
   * because the standard helper consumes the entire match, including the
   * trailing terminator — and we want to preserve that character.
   *
   * Like the paste rule, we skip conversion when the cursor is inside a
   * reference list item so the `[N]` labels in the bibliography stay
   * literal text.
   */
  addInputRules() {
    const nodeType = this.type;
    return [
      new InputRule({
        find: /\[(\d+)\]([\s.,;:!?\])])$/,
        handler: ({ state, range, match, chain }) => {
          if (isInsideReferenceListItem(state.doc, range.from)) return null;
          const refId = Number(match[1]);
          if (!Number.isInteger(refId) || refId < 1) return null;
          const terminator = match[2] ?? "";
          // `range.to` is the cursor BEFORE the terminator was typed; the
          // bracket text "[N]" sits at range.from..range.to. We delete the
          // bracket portion, drop a citation node in its place, then re-insert
          // the terminator. Using chain() lets TipTap's Tracker manage
          // position drift across these mutations safely.
          chain()
            .deleteRange({ from: range.from, to: range.to })
            .insertContentAt(range.from, {
              type: nodeType.name,
              attrs: { refId },
            })
            .insertContent(terminator)
            .command(({ state: chainState, tr }) => {
              safeEnsureReferencePlaceholder(chainState, tr, refId);
              return true;
            })
            .run();
        },
      }),
    ];
  },
});

/**
 * Drop-in replacement for StarterKit's ListItem that adds a `refId`
 * attribute. The cold-start pipeline already writes this attribute when it
 * builds the References list (each `listItem.attrs.refId = N` is the
 * `id="ref-N"` anchor target). Without declaring it on the schema, the
 * editor would silently strip `refId` whenever a contributor opened an
 * article — breaking the back-link to the bibliography.
 *
 * Mount this extension in `extensions.ts`; remember to disable StarterKit's
 * built-in `listItem` (`StarterKit.configure({ listItem: false })`) so this
 * one is the only ListItem in the schema.
 */
export const ListItemWithRefId = ListItem.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      refId: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-ref-id");
          if (!raw) return null;
          const n = Number(raw);
          return Number.isInteger(n) && n >= 1 ? n : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.refId) return {};
          return { "data-ref-id": String(attrs.refId) };
        },
      },
    };
  },
});

/**
 * Normalize Unicode superscript digit runs in pasted plain text into
 * bracketed form so the paste rule on `CitationNode` can pick them up.
 * Example: `program.¹²` → `program.[12]`.
 *
 * Used as the `editorProps.transformPastedText` callback in TipTap's
 * `useEditor` constructor (see `wiki-article-shell.tsx`).
 */
export function transformSuperscriptPaste(text: string): string {
  const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => {
    const ascii = run
      .split("")
      .map((ch) => String(SUP_DIGITS.indexOf(ch)))
      .join("");
    return `[${ascii}]`;
  });
}

// -----------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------

/**
 * Largest `refId` currently used anywhere in the document plus one.
 * Returns `1` for a fresh article with no citations.
 * Walks the doc once, looking at every node — citations carry `refId`,
 * reference-list items carry it too, so we union both.
 */
function nextAvailableRefId(editor: Editor): number {
  let max = 0;
  editor.state.doc.descendants((node) => {
    const refId = Number(node.attrs?.refId);
    if (Number.isInteger(refId) && refId > max) max = refId;
    return true;
  });
  return max + 1;
}

/**
 * Ensure the References list at the bottom of the article has an entry
 * for `refId`. If one already exists (any listItem with that refId attr),
 * no-op. If the list doesn't exist yet, append a fresh `bulletList`
 * containing the placeholder entry at the end of the doc.
 *
 * Mutations happen on `tr` so the calling command's whole operation
 * (citation insert + placeholder add) is one atomic undo step.
 */
/**
 * Defensive wrapper: ensureReferencePlaceholder touches positions across
 * a mid-flight transaction, and ProseMirror is unforgiving about stale
 * positions ("Position N out of range" RangeError). Wrap any failure in a
 * console warning rather than letting it bubble up and break the user's
 * keystroke or submit. The worst case is a missing placeholder, which the
 * contributor can add manually.
 */
function safeEnsureReferencePlaceholder(
  state: EditorState,
  tr: Transaction,
  refId: number,
): void {
  try {
    ensureReferencePlaceholder(state, tr, refId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[citation-extension] Could not append placeholder for [${refId}]:`,
      err,
    );
  }
}

function ensureReferencePlaceholder(
  state: EditorState,
  tr: Transaction,
  refId: number,
): void {
  // CRITICAL: walk `tr.doc` not `state.doc`. The chain that calls us may
  // have already inserted / deleted content, so `state.doc.content.size`
  // (the pre-mutation size) is unsafe to feed back into `tr.insert(...)`.
  // Mixing them produces "Position N out of range" RangeErrors.
  if (referenceExistsFor(tr.doc, refId)) return;

  const listItemType = state.schema.nodes.listItem;
  const bulletListType = state.schema.nodes.bulletList;
  const paragraphType = state.schema.nodes.paragraph;
  if (!listItemType || !bulletListType || !paragraphType) return;

  const placeholderItem = listItemType.create(
    { refId },
    paragraphType.create(
      null,
      state.schema.text(`[${refId}] — (add source URL)`),
    ),
  );

  const docSize = tr.doc.content.size;
  const existing = findReferencesList(tr.doc);
  if (existing) {
    // Insert at the end of the existing references list. The bulletList
    // node's content runs from pos+1 (after the open) to pos+nodeSize-1
    // (before the close); we drop the new listItem at the close position.
    // Clamp defensively in case the heuristic ran on a stale doc.
    const target = existing.pos + existing.node.nodeSize - 1;
    const insertPos = Math.max(0, Math.min(target, docSize));
    tr.insert(insertPos, placeholderItem);
    return;
  }

  const newList = bulletListType.create(null, placeholderItem);
  tr.insert(docSize, newList);
}

/**
 * True iff `pos` lies inside an entry of the References list at the bottom
 * of the article. Used to suppress citation auto-conversion in those
 * entries so the literal `[N]` label (which mirrors the anchor target)
 * isn't replaced by a recursive citation superscript.
 *
 * Two-tier detection because cold-start articles authored before our
 * `ListItemWithRefId` swap may have lost the schema attr:
 *   1) Any ancestor `listItem` whose `attrs.refId` is set — definitive.
 *   2) Fallback: position falls inside the bulletList that `findReferencesList`
 *      identifies as the references block (text-shape heuristic).
 */
function isInsideReferenceListItem(
  doc: ProseMirrorNode,
  pos: number,
): boolean {
  if (pos < 0 || pos > doc.content.size) return false;
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name !== "listItem") continue;
    const refId = Number(node.attrs?.refId);
    if (Number.isInteger(refId) && refId >= 1) return true;
    // Text-shape fallback for entries that lost their schema attr.
    if (listItemLooksLikeReference(node)) return true;
  }
  const refList = findReferencesList(doc);
  if (refList && pos >= refList.pos && pos <= refList.pos + refList.node.nodeSize) {
    return true;
  }
  return false;
}

/** True iff any listItem in `doc` already carries `refId`. */
function referenceExistsFor(doc: ProseMirrorNode, refId: number): boolean {
  let found = false;
  doc.descendants((node) => {
    if (found) return false;
    if (node.type.name !== "listItem") return true;
    if (Number(node.attrs?.refId) === refId) found = true;
    return true;
  });
  return found;
}

/**
 * The first paragraph of a reference entry starts with a bracketed integer
 * (e.g. `[3] Some Title — https://…`). This is the visual contract every
 * entry produced by the cold-start synthesizer follows; we use it as a
 * fallback identifier when the schema-level `refId` attr is missing.
 */
function listItemLooksLikeReference(node: ProseMirrorNode): boolean {
  const firstChild = node.firstChild;
  if (!firstChild) return false;
  const text = firstChild.textContent ?? "";
  return /^\[\d+\]/.test(text);
}

/**
 * Locate the references-style bulletList in the doc.
 *
 * We pick the LAST top-level bulletList where ANY child looks like a
 * reference entry (refId attr set, or first paragraph starts with `[N]`).
 * The lenient "any" check is deliberate: cold-start articles in the wild
 * sometimes have a few corrupted entries (e.g. "S[3]ystems Design" where
 * the bracket got displaced into the title). A stricter all-must-match
 * check would reject those lists entirely, and we'd then create a NEW
 * references list elsewhere — confusing the contributor.
 */
function findReferencesList(
  doc: ProseMirrorNode,
): { node: ProseMirrorNode; pos: number } | null {
  let match: { node: ProseMirrorNode; pos: number } | null = null;
  doc.forEach((child, offset) => {
    if (child.type.name !== "bulletList" || child.childCount === 0) return;
    let anyLooksLikeRef = false;
    child.forEach((listItem) => {
      const refId = Number(listItem.attrs?.refId);
      const hasAttr = Number.isInteger(refId) && refId >= 1;
      if (hasAttr || listItemLooksLikeReference(listItem)) anyLooksLikeRef = true;
    });
    if (anyLooksLikeRef) match = { node: child, pos: offset };
  });
  return match;
}

// -----------------------------------------------------------------------
// TypeScript: surface our custom commands on the chained-commands type.
// Without this, `editor.chain().insertNextCitation()` fails to type-check.
// -----------------------------------------------------------------------

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (refId: number) => ReturnType;
      insertNextCitation: () => ReturnType;
    };
  }
}
