"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Match the per-element foreground classes the wiki article shell uses
// (`prose-p:text-foreground`, `prose-li:...`, etc.). Without them, body
// paragraphs fall back to the prose-neutral default — which reads as
// near-black in dark mode (where `dark:prose-invert` flips it to white)
// but stays a pale gray in LIGHT mode, making the answer text almost
// invisible. The per-element overrides force every text node to use
// `var(--foreground)` so the answer renders correctly in both themes.
const PROSE_CLASSES =
  "prose prose-neutral dark:prose-invert max-w-none font-serif text-foreground " +
  "[--tw-prose-body:var(--foreground)] [--tw-prose-headings:var(--foreground)] " +
  "[--tw-prose-lead:var(--muted-foreground)] [--tw-prose-bold:var(--foreground)] " +
  "[--tw-prose-counters:var(--muted-foreground)] [--tw-prose-bullets:var(--border)] " +
  "[--tw-prose-hr:var(--border)] [--tw-prose-quotes:var(--foreground)] " +
  "[--tw-prose-quote-borders:var(--border)] [--tw-prose-captions:var(--muted-foreground)] " +
  "[--tw-prose-code:var(--foreground)] [--tw-prose-pre-code:var(--foreground)] " +
  "[--tw-prose-pre-bg:var(--surface-2)] [--tw-prose-th-borders:var(--border)] " +
  "[--tw-prose-td-borders:var(--border)] " +
  "prose-headings:font-serif prose-headings:text-foreground " +
  "prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground " +
  "prose-a:text-foreground prose-a:underline-offset-4 " +
  "prose-blockquote:border-foreground/30";

export function RagMarkdown({ children }: { children: string }) {
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="!text-[color:var(--link)] underline-offset-4 hover:underline"
              {...props}
            >
              {linkChildren}
            </a>
          ),
          code: ({ className, children: codeChildren, ...props }) => {
            const isBlock = /\blanguage-/.test(className ?? "");
            if (isBlock) {
              return (
                <code
                  className={`block overflow-x-auto rounded-md border border-border bg-[color:var(--surface-2)] p-3 text-sm ${className ?? ""}`}
                  {...props}
                >
                  {codeChildren}
                </code>
              );
            }
            return (
              <code
                className="rounded border border-border bg-[color:var(--surface-2)] px-1 py-0.5 font-mono text-[0.85em]"
                {...props}
              >
                {codeChildren}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
