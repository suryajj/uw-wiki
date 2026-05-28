import type { ReactNode } from "react";

import type { ProseMirrorDoc, ProseMirrorNode } from "@/types/domain";

type Mark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type RenderOptions = {
  /** Wrap H2 headings with `data-section-slug` so FRD-3 anchoring works. */
  decorateSections?: boolean;
};

const SAFE_IMAGE_SRC =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/|^\//i;
const SAFE_LINK_HREF = /^https?:\/\/[^\s]+$|^\/[^\s]*$/i;

export function renderProseMirrorDoc(
  doc: ProseMirrorDoc,
  options: RenderOptions = {},
): ReactNode {
  const content = doc.content ?? [];
  return content.map((node, index) => renderNode(node, `${index}`, options));
}

/**
 * Pull the leading `[N]` from a block-level node so we can synthesize an
 * `id="ref-N"` anchor for citation back-links — even when the contributor
 * authored the References section as plain paragraphs / listItems WITHOUT
 * the schema-level `refId` attribute the cold-start pipeline emits.
 *
 * This is the "make the link target findable" half of citation scroll-to;
 * the body's `<a href="#ref-N">[N]</a>` is unchanged.
 */
function leadingRefId(node: ProseMirrorNode): number | null {
  const text = collectText(node).trimStart();
  const match = text.match(/^\[(\d+)\]/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function collectText(node: ProseMirrorNode): string {
  if (node.type === "text") return node.text ?? "";
  const children = node.content;
  if (!children) return "";
  return children.map(collectText).join("");
}

function renderNode(
  node: ProseMirrorNode,
  key: string,
  options: RenderOptions,
): ReactNode {
  switch (node.type) {
    case "paragraph": {
      // Anchor fallback: if this paragraph's text starts with `[N]` (i.e.
      // it's a plain-text reference entry like "[1] — Source — URL"),
      // expose it as the `#ref-N` scroll target. Without this, citation
      // back-links navigate to a hash that has no matching element when
      // the contributor wrote References as paragraphs rather than the
      // cold-start bulletList shape.
      const paraRefId = leadingRefId(node);
      const paraId = paraRefId !== null ? `ref-${paraRefId}` : undefined;
      return (
        <p
          key={key}
          id={paraId}
          className={`mb-4 break-words leading-7 text-foreground${
            paraId ? " ref-target scroll-mt-24" : ""
          }`}
        >
          {renderChildren(node, key, options)}
        </p>
      );
    }
    case "heading": {
      const level = Number(node.attrs?.level) || 2;
      const slug =
        typeof node.attrs?.slug === "string"
          ? (node.attrs.slug as string)
          : undefined;
      const isOfficial = node.attrs?.official === true;
      const baseClass =
        level === 2
          ? "scroll-mt-24 mt-10 mb-4 text-2xl font-semibold text-foreground"
          : "scroll-mt-20 mt-6 mb-3 text-lg font-medium text-foreground";
      const officialClass = isOfficial
        ? "border-l-4 border-primary pl-3 bg-primary/5"
        : "";
      const dataAttrs =
        options.decorateSections && level === 2 && slug
          ? { "data-section-slug": slug }
          : {};

      const children = renderChildren(node, key, options);
      const HeadingTag = (level === 3 ? "h3" : "h2") as "h2" | "h3";
      return (
        <HeadingTag
          key={key}
          id={slug}
          className={`${baseClass} ${officialClass}`.trim()}
          {...dataAttrs}
        >
          {children}
          {level === 2 && isOfficial ? (
            <span className="ml-3 align-middle text-xs font-medium uppercase tracking-wide text-primary">
              Official
            </span>
          ) : null}
        </HeadingTag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="mb-4 list-disc space-y-1 break-words pl-6 text-foreground">
          {renderChildren(node, key, options)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="mb-4 list-decimal space-y-1 break-words pl-6 text-foreground">
          {renderChildren(node, key, options)}
        </ol>
      );
    case "listItem": {
      // Two paths to the same anchor:
      //   1) Schema-level refId attr (cold-start emits this on its
      //      generated References bulletList).
      //   2) Leading `[N]` text fallback (covers entries authored as a
      //      plain list where the schema attr never made it, including
      //      pre-`ListItemWithRefId` articles).
      const refIdAttr = Number(node.attrs?.refId);
      const fromAttr =
        Number.isInteger(refIdAttr) && refIdAttr >= 1 ? refIdAttr : null;
      const refId = fromAttr ?? leadingRefId(node);
      const id = refId !== null ? `ref-${refId}` : undefined;
      return (
        <li
          key={key}
          id={id}
          className={id ? "ref-target scroll-mt-24" : undefined}
        >
          {renderChildren(node, key, options)}
        </li>
      );
    }
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="mb-4 border-l-4 border-border pl-4 italic text-muted-foreground"
        >
          {renderChildren(node, key, options)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          className="mb-4 overflow-x-auto rounded-md bg-card p-3 text-sm text-foreground"
        >
          <code>{renderChildren(node, key, options)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} className="my-6 border-border" />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      if (!src || !SAFE_IMAGE_SRC.test(src)) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={src}
          alt={alt}
          loading="lazy"
          className="my-4 max-w-full rounded-md border border-border"
        />
      );
    }
    case "table":
      return (
        <table key={key} className="mb-4 w-full border-collapse text-sm">
          <tbody>{renderChildren(node, key, options)}</tbody>
        </table>
      );
    case "tableRow":
      return <tr key={key}>{renderChildren(node, key, options)}</tr>;
    case "tableHeader":
      return (
        <th key={key} className="border border-border bg-muted px-3 py-1 text-left">
          {renderChildren(node, key, options)}
        </th>
      );
    case "tableCell":
      return (
        <td key={key} className="border border-border px-3 py-1 align-top">
          {renderChildren(node, key, options)}
        </td>
      );
    case "text":
      return renderText(node, key);
    case "citation": {
      const refId = Number(node.attrs?.refId);
      if (!Number.isInteger(refId) || refId < 1) return null;
      return (
        <sup key={key} className="ml-0.5 text-[10px] font-medium leading-none">
          <a
            href={`#ref-${refId}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            [{refId}]
          </a>
        </sup>
      );
    }
    default:
      return null;
  }
}

function renderChildren(
  node: ProseMirrorNode,
  parentKey: string,
  options: RenderOptions,
): ReactNode {
  const children = node.content ?? [];
  return children.map((child, index) =>
    renderNode(child, `${parentKey}-${index}`, options),
  );
}

function renderText(node: ProseMirrorNode, key: string): ReactNode {
  const marks = (node.marks ?? []) as Mark[];
  let element: ReactNode = node.text ?? "";
  for (const mark of marks) {
    element = applyMark(element, mark, key);
  }
  return <span key={key}>{element}</span>;
}

function applyMark(content: ReactNode, mark: Mark, key: string): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong key={`${key}-bold`}>{content}</strong>;
    case "italic":
      return <em key={`${key}-italic`}>{content}</em>;
    case "underline":
      return <u key={`${key}-underline`}>{content}</u>;
    case "strike":
      return <s key={`${key}-strike`}>{content}</s>;
    case "code":
      return (
        <code
          key={`${key}-code`}
          className="rounded bg-muted px-1 py-0.5 text-xs"
        >
          {content}
        </code>
      );
    case "highlight":
      return (
        <mark key={`${key}-highlight`} className="bg-primary/20 px-0.5">
          {content}
        </mark>
      );
    case "link": {
      const href = String(mark.attrs?.href ?? "");
      if (!SAFE_LINK_HREF.test(href)) {
        return content;
      }
      return (
        <a
          key={`${key}-link`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline-offset-4 hover:underline"
        >
          {content}
        </a>
      );
    }
    default:
      return content;
  }
}
