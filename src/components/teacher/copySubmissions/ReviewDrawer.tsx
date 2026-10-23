// src/components/teacher/copySubmissions/ReviewDrawer.tsx
// One attempt: the student's original pages (signed URLs, bucket "submissions") next to the per-question marks +
// comments (AiQuestionList, override → override_marks RPC), the change history (submission_mark_history) and the
// red-pen copy (existing jsPDF markedCopyExport, from the checker's upright page images).

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, PenLine } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AiQuestionList, effectiveTotal } from "@/components/checker/AiGradeBreakdown";
import { buildMarkedCopyPdf, downloadMarkedCopy } from "@/components/checker/markedCopyExport";
import type { CheckSession, CheckSheet } from "@/components/checker/copyCheckerApi";
import { supabase } from "@/lib/supabaseClient";
import { fmtIST } from "@/lib/uploadFlow";
import { REVIEW_LABEL, teacherBadge } from "@/lib/uploadLink/status";
import {
  type MarkEvent, type StudentInfo, type TeacherAttempt, markHistory, overrideMarks, signedSubmissionUrls,
} from "@/lib/uploadLink/teacher";
import { Chip, Spinner, ToneChip } from "@/components/uploadLink/ui";
import { rejectText } from "@/lib/uploadLink/messages";

const EVENT_LABEL: Record<string, string> = {
  publish: "Published", auto_publish: "Auto-published", unpublish: "Unpublished",
  teacher_override: "Marks changed", regrade: "Re-graded", ai_check: "AI check",
};

export default function ReviewDrawer({ attempt, student, onClose, onChanged }: {
  attempt: TeacherAttempt | null; student: StudentInfo | null; onClose: () => void; onChanged: () => void;
}) {
  const [sheet, setSheet] = useState<CheckSheet | null>(null);
  const [session, setSession] = useState<CheckSession | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<MarkEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [penUrl, setPenUrl] = useState<string | null>(null);
  const [penBusy, setPenBusy] = useState(false);

  const load = useCallback(async () => {
    if (!attempt) return;
    setLoading(true);
    try {
      const [{ data: sh }, signed, hist] = await Promise.all([
        supabase.from("check_sheets").select("*").eq("submission_id", attempt.id).maybeSingle(),
        signedSubmissionUrls(attempt.files.map(f => f.storage_path)),
        markHistory(attempt.id).catch(() => ({ state: "error", events: [] as MarkEvent[] })),
      ]);
      setSheet(sh as CheckSheet | null);
      setUrls(signed);
      setEvents(hist.events || []);
      if (sh?.session_id) {
        const { data: ss } = await supabase.from("check_sessions").select("*").eq("id", sh.session_id).maybeSingle();
        setSession(ss as CheckSession | null);
      }
    } finally {
      setLoading(false);
    }
  }, [attempt]);

  useEffect(() => {
    setSheet(null); setSession(null); setUrls({}); setEvents([]);
    if (penUrl) URL.revokeObjectURL(penUrl);
    setPenUrl(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id]);

  async function onOverride(qNo: string, marks: number, note: string) {
    if (!attempt) return;
    const r = await overrideMarks(attempt.id, qNo, marks, note);
    if (r.state !== "ok") throw new Error(r.message || "Couldn't save the marks.");
    toast.success(r.published ? `Marks changed — the student now sees ${r.total}` : "Marks changed");
    await load();
    onChanged();
  }

  async function previewRedPen() {
    if (!sheet || !session) return;
    setPenBusy(true);
    try {
      const blob = await buildMarkedCopyPdf(session, sheet, { urls: {}, blind: false });
      if (penUrl) URL.revokeObjectURL(penUrl);
      setPenUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error && /No page images/.test(e.message)
        ? "Red-pen pages not found (only the teacher who made the assignment can open them)."
        : e instanceof Error ? e.message : "Couldn't make the red-pen copy.");
    }
    setPenBusy(false);
  }

  async function downloadRedPen() {
    if (!sheet || !session) return;
    setPenBusy(true);
    try { await downloadMarkedCopy(session, sheet, { urls: {}, blind: false }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download failed."); }
    setPenBusy(false);
  }

  const r = sheet?.ai_result;
  const reasons = attempt?.sheet?.needs_review_reasons || [];

  return (
    <Sheet open={!!attempt} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-5xl" data-testid="review-drawer">
        {attempt && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {student?.name || "Student"} · Upload-{attempt.attempt_no}
                <ToneChip badge={teacherBadge(attempt.status)} />
                {attempt.is_late && <Chip tone="amber">Late</Chip>}
              </SheetTitle>
              <SheetDescription>
                {fmtIST(attempt.submitted_at)} · {attempt.files.length} file
                {student?.roll_no ? ` · Roll ${student.roll_no}` : ""}{student?.class_level ? ` · Class ${student.class_level}` : ""}
              </SheetDescription>
            </SheetHeader>

            {reasons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">{reasons.map(x => <Chip key={x} tone="violet">{REVIEW_LABEL[x] || x}</Chip>)}</div>
            )}
            {attempt.reject_reasons.length > 0 && (
              <ul className="mt-3 list-disc rounded-lg bg-red-50 p-3 pl-6 text-sm text-red-700">
                {attempt.reject_reasons.map((x, i) => <li key={i}>{rejectText(x)}</li>)}
              </ul>
            )}
            {loading && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Original pages</h4>
                {attempt.files.map(f => {
                  const u = urls[f.storage_path];
                  return (
                    <figure key={f.storage_path} className="overflow-hidden rounded-lg border">
                      <figcaption className="flex items-center justify-between bg-muted px-2 py-1 text-xs">
                        <span>Page {f.page_order}</span>
                        {f.dup_other_student && <Chip tone="red">Same file as another student</Chip>}
                      </figcaption>
                      {!u ? <p className="p-3 text-xs text-muted-foreground">Couldn't open the file (no access or file missing).</p>
                        : f.mime.startsWith("image/") ? <img src={u} alt={`Page ${f.page_order}`} className="w-full" loading="lazy" />
                          : <a href={u} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-sm font-semibold text-gray-900 underline">
                              <FileText className="h-4 w-4" /> Open PDF
                            </a>}
                    </figure>
                  );
                })}
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="flex-1 text-sm font-semibold">Marks + comments</h4>
                  {r && <span className="text-lg font-extrabold">{effectiveTotal(r)}/{r.max_marks}</span>}
                </div>
                {!r ? <p className="text-sm text-muted-foreground">No AI result yet.</p> : (
                  <>
                    {r.overall_remarks && <p className="rounded-lg bg-muted p-2 text-sm">{r.overall_remarks}</p>}
                    <AiQuestionList questions={r.graded_questions || []}
                      onOverride={["checked", "approved"].includes(sheet?.status || "") ? onOverride : undefined} />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={previewRedPen} disabled={penBusy}>
                        {penBusy ? <Spinner /> : <><PenLine className="mr-1 h-4 w-4" /> Red-pen preview</>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadRedPen} disabled={penBusy}>
                        <Download className="mr-1 h-4 w-4" /> Red-pen PDF
                      </Button>
                    </div>
                    {penUrl && <iframe title="Red-pen copy" src={penUrl} className="h-[70vh] w-full rounded-lg border" />}
                  </>
                )}

                <div>
                  <h4 className="mb-1 text-sm font-semibold">Change history</h4>
                  <p className="mb-2 text-xs text-muted-foreground">Old marks stay here — overrides and re-grades never delete anything.</p>
                  {events.length === 0 ? <p className="text-xs text-muted-foreground">No changes yet.</p> : (
                    <ul className="space-y-1 text-xs" data-testid="history-events">
                      {events.map((e, i) => (
                        <li key={i} className="rounded border px-2 py-1">
                          <b>{EVENT_LABEL[e.type] || e.type}</b> · {fmtIST(e.at)}{e.by_me ? " · by you" : ""}
                          {e.remarks ? <span className="block text-muted-foreground">{e.remarks}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
