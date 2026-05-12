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

function renderNode(
  node: ProseMirrorNode,
  key: string,
  options: RenderOptions,
): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="mb-4 leading-7 text-foreground">
          {renderChildren(node, key, options)}
        </p>
      );
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
        <ul key={key} className="mb-4 list-disc space-y-1 pl-6 text-foreground">
          {renderChildren(node, key, options)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="mb-4 list-decimal space-y-1 pl-6 text-foreground">
          {renderChildren(node, key, options)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderChildren(node, key, options)}</li>;
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
          className="text-primary underline-offset-4 hover:underline"
        >
          {content}
        </a>
      );
    }
    default:
      return content;
  }
}
