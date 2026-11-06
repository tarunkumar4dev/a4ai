// Assistant prose: Markdown + GFM (tables, lists, strikethrough). No raw HTML (skipHtml), no images, only
// http(s) links (new tab, noopener noreferrer). React escapes all text; nothing is injected as HTML here.
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { agentUrlTransform, safeHref } from "@/lib/agent/markdown";

const components: Components = {
  a: ({ href, children }) => {
    const url = safeHref(href);
    return url
      ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">{children}</a>
      : <span>{children}</span>;
  },
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  h1: ({ children }) => <p className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mb-1 mt-3 text-sm font-semibold first:mt-0">{children}</p>,
  h4: ({ children }) => <p className="mb-1 mt-3 text-sm font-semibold first:mt-0">{children}</p>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm">{children}</table></div>,
  th: ({ children }) => <th className="whitespace-nowrap border-b border-border bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-3 py-2 align-top">{children}</td>,
};

export const AgentMarkdown = memo(function AgentMarkdown({ text }: { text: string }) {
  return (
    <div className="break-words text-[15px] leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img"]} unwrapDisallowed
        urlTransform={agentUrlTransform} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
