import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

import { CitationNode, ListItemWithRefId } from "@/lib/editor/citation-extension";

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    // Replace the stock ListItem with our refId-aware variant so the
    // references list at the bottom of cold-start articles round-trips
    // through the editor without losing its `id="ref-N"` anchors.
    listItem: false,
  }),
  ListItemWithRefId,
  Underline,
  Highlight,
  Link.configure({
    autolink: true,
    openOnClick: false,
    HTMLAttributes: {
      class: "text-primary underline underline-offset-4",
    },
  }),
  Image.configure({
    inline: true,
    allowBase64: false,
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({
    placeholder: "Start writing...",
  }),
  CitationNode,
];
