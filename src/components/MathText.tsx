// src/components/MathText.tsx
// KaTeX-based LaTeX renderer — handles $...$ inline math perfectly
import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathTextProps {
  text: string;
  className?: string;
}

// Text shown as-is (KaTeX failed, or plain text): always escaped, never parsed as HTML.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MathText = ({ text, className = "" }: MathTextProps) => {
  const rendered = useMemo(() => {
    if (!text) return "";

    try {
      // Split on $...$ patterns (inline math)
      const parts = text.split(/(\$[^$]+\$)/g);

      return parts
        .map((part) => {
          // Check if this part is a LaTeX expression (wrapped in $...$)
          if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
            const latex = part.slice(1, -1); // Remove $ delimiters
            try {
              return katex.renderToString(latex, {
                throwOnError: false,
                displayMode: false,
                trust: true,
                strict: false,
              });
            } catch {
              // If KaTeX fails, show the source as plain text
              return esc(latex);
            }
          }
          // Regular text — escape HTML
          return part
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>");
        })
        .join("");
    } catch {
      return esc(text);
    }
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
};

export default MathText;