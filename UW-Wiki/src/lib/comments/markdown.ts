/**
 * Comment markdown renderer. The output is fed directly into
 * `dangerouslySetInnerHTML`, so this function is responsible for:
 *
 * 1. Escaping every untrusted character before pattern substitution.
 * 2. Only emitting tags from a fixed allowlist (<strong>, <em>, <a>, <br>).
 * 3. Refusing any link href that is not http(s).
 *
 * We deliberately avoid `isomorphic-dompurify` because it pulls in
 * `cssstyle`/`@csstools/css-calc` ESM that breaks Next.js dev SSR. The
 * regex pipeline is a smaller attack surface as long as it always runs on
 * already-escaped input.
 */
const SAFE_LINK_HREF = /^https?:\/\/[^\s)]+$/i;

export function renderCommentMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, rawHref: string) => {
    if (!SAFE_LINK_HREF.test(rawHref)) {
      // Drop the link entirely — render the label as plain text.
      return label;
    }
    return `<a href="${rawHref}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${label}</a>`;
  });
  html = html.replace(/\n/g, "<br>");
  return html;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
