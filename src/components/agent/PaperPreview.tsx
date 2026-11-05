import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaperPreview as PaperPreviewEvent, VerifyStatus } from "@/lib/agent/events";
import { AgentMath } from "./AgentMath";

const STATUS: Record<VerifyStatus, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "bg-green-100 text-green-800 border-green-200" },
  rubric_ok: { label: "Rubric OK", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  manual_review: { label: "Manual review", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-800 border-red-200" },
};

export function PaperPreview({ ev }: { ev: PaperPreviewEvent }) {
  const [showKey, setShowKey] = useState(false);
  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{ev.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{ev.total_marks} marks · {ev.duration_min} min · {ev.questions.length} questions</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <ol className="space-y-3">
          {ev.questions.map((q, i) => {
            const st = STATUS[q.status] ?? STATUS.manual_review;
            return (
              <li key={q.id} className="break-words border-b pb-3 last:border-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Q{i + 1}</span>
                  <span>Sec {q.section}</span>
                  <span>{q.marks} m</span>
                  <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                </div>
                <AgentMath text={q.text} className="text-sm" />
                {q.options && q.options.length > 0 ? (
                  <ol className="mt-1 space-y-0.5 pl-5 text-sm" type="a">
                    {q.options.map((o, oi) => <li key={oi}><AgentMath text={o} /></li>)}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ol>
        <Button type="button" variant="outline" size="sm" aria-expanded={showKey} onClick={() => setShowKey((v) => !v)}>
          {showKey ? "Hide answer key" : "Show answer key"}
        </Button>
        {showKey ? (
          <ol className="space-y-2 text-sm">
            {ev.questions.map((q, i) => (
              <li key={q.id} className="break-words">
                <span className="font-medium">Q{i + 1}: </span>
                {q.answer ? <AgentMath text={q.answer} /> : <span className="text-muted-foreground">—</span>}
                {q.marking_scheme && q.marking_scheme.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                    {q.marking_scheme.map((m, mi) => <li key={mi}><AgentMath text={m} /></li>)}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </CardContent>
    </Card>
  );
}
