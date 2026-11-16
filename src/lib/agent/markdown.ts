// URL policy for assistant prose (react-markdown). Raw HTML is never rendered (skipHtml); only http(s) links
// become <a> (new tab, rel=noopener noreferrer); everything else (javascript:, data:, relative, mailto:) is text.

/** The URL when it is an absolute http(s) URL, else null. */
export function safeHref(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** react-markdown urlTransform: unsafe URLs become "" (the <a> renderer then prints plain text). */
export const agentUrlTransform = (url: string): string => safeHref(url) ?? "";
