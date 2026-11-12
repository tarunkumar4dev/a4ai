// $...$ inline math via KaTeX (trust:false, throwOnError:false). Plain text is escaped, and the
// combined HTML is sanitized with DOMPurify before it is injected.
import { useMemo } from "react";
import DOMPurify from "dompurify";
import katex from "katex";
import "katex/dist/katex.min.css";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderMathHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/(\$[^$]+\$)/g)
    .map((part) => {
      if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
        try {
          return katex.renderToString(part.slice(1, -1), { throwOnError: false, trust: false, strict: "ignore", displayMode: false });
        } catch {
          return esc(part);
        }
      }
      return esc(part).replace(/\n/g, "<br/>");
    })
    .join("");
}

export function AgentMath({ text, className }: { text: string; className?: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(renderMathHtml(text), { USE_PROFILES: { html: true, mathMl: true, svg: true } }),
    [text],
  );
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
