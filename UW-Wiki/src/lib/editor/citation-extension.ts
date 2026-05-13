import { Node, mergeAttributes } from "@tiptap/core";

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
});
