// src/components/teacher/copySubmissions/CopySubmissionsTab.tsx
// "Copy Submissions" tab of an assignment: the upload link's settings, every student's upload attempts (one row
// per student by the count policy, expand for all attempts), review, publish / unpublish, retry of failed checks,
// re-grade after a key change, and result sharing on WhatsApp. Checking itself is the backend worker's job —
// nothing here starts a check except an explicit retry / re-grade. Contract: docs/upload-flow-api.md.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConfirm } from "@/components/checker/useConfirm";
import { humanError } from "@/components/checker/checkerFetch";
import { fmtIST } from "@/lib/uploadFlow";
import { IN_PIPELINE, REVIEW_LABEL, teacherBadge } from "@/lib/uploadLink/status";
import {
  type LinkSettings, type StudentInfo, type StudentRow, type TeacherAttempt, buildStudentRows, linkUrl,
  loadCopySubmissions, loadLinkSettings, publishResults, regradeSubmissions, resultMessage, retryChecks, unpublishResults,
} from "@/lib/uploadLink/teacher";
import { openWhatsApp } from "@/lib/whatsapp";
import { rejectText } from "@/lib/uploadLink/messages";
import { BLACK_BTN } from "@/lib/uploadLink/styles";
import { Chip, Spinner, ToneChip } from "@/components/uploadLink/ui";
import LinkSettingsCard from "./LinkSettingsCard";
import ReviewDrawer from "./ReviewDrawer";

type StatusFilter = "all" | "pipeline" | "checked" | "needs_review" | "published" | "problem";
const POLL_MS = 15_000;
const STALE_STATUSES = ["checked", "needs_review", "published", "failed"];

const pagesOf = (a: TeacherAttempt) => a.files.length;
const isDup = (a: TeacherAttempt) => a.files.some(f => f.dup_other_student);

function matches(a: TeacherAttempt | null, status: StatusFilter, onlyReview: boolean, onlyLate: boolean): boolean {
  if (!a) return false;
  if (onlyReview && !(a.status === "needs_review" || (a.sheet?.needs_review_reasons.length || 0) > 0)) return false;
  if (onlyLate && !a.is_late) return false;
  switch (status) {
    case "pipeline": return IN_PIPELINE.includes(a.status);
    case "checked": return a.status === "checked";
    case "needs_review": return a.status === "needs_review";
    case "published": return a.status === "published";
    case "problem": return a.status === "failed" || a.status === "rejected";
    default: return true;
  }
}

export default function CopySubmissionsTab({ assignment, onEditAssignment }: {
  assignment: { id: string; title: string; batch_name?: string | null };
  onEditAssignment: () => void;
}) {
  const [settings, setSettings] = useState<LinkSettings | null>(null);
  const [attempts, setAttempts] = useState<TeacherAttempt[]>([]);
  const [students, setStudents] = useState<Record<string, StudentInfo>>({});
  const [keyVersion, setKeyVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [onlyReview, setOnlyReview] = useState(false);
  const [onlyLate, setOnlyLate] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<TeacherAttempt | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [unpub, setUnpub] = useState<{ ids: string[]; reason: string } | null>(null);
  const { ask, dialog } = useConfirm();

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [s, data] = await Promise.all([loadLinkSettings(assignment.id), loadCopySubmissions(assignment.id)]);
      setSettings(s);
      setAttempts(data.attempts);
      setStudents(data.students);
      setKeyVersion(data.keyVersion);
      setError("");
    } catch (e) {
      setError(humanError(e));
    }
    setLoading(false);
  }, [assignment.id]);

  useEffect(() => { load(); }, [load]);

  // the worker changes statuses on its own — refresh while anything is still in the pipeline
  const live = attempts.some(a => IN_PIPELINE.includes(a.status));
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(true); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [live, load]);

  const rows: StudentRow[] = useMemo(
    () => buildStudentRows(attempts, students, settings?.count_policy || "latest"), [attempts, students, settings?.count_policy]);
  const shown = rows.filter(r => matches(r.counted, status, onlyReview, onlyLate));
  const stale = attempts.filter(a => keyVersion != null && a.answer_key_version != null
    && a.answer_key_version < keyVersion && STALE_STATUSES.includes(a.status));
  const counts = {
    students: rows.length,
    pipeline: rows.filter(r => r.counted && IN_PIPELINE.includes(r.counted.status)).length,
    review: rows.filter(r => r.counted?.status === "needs_review").length,
    ready: rows.filter(r => r.counted && ["checked", "needs_review"].includes(r.counted.status)).length,
    published: rows.filter(r => r.counted?.status === "published").length,
  };

  function flagBlocked(ids: string[]) {
    setHighlight(new Set(ids));
    window.setTimeout(() => setHighlight(new Set()), 10_000);
  }

  async function publishAll() {
    if (!(await ask({ title: "Publish all results?", confirmLabel: "Publish all",
      description: "Students will see the marks of checked copies. Copies still being checked can be published later." }))) return;
    setBusy("all");
    try {
      const r = await publishResults({ assignmentId: assignment.id });
      if (r.state !== "ok") throw new Error(r.state === "forbidden" ? "You don't have access to this assignment." : "Couldn't publish.");
      const n = r.published?.length || 0, b = r.blocked || [];
      if (n) toast.success(`${n} result${n === 1 ? "" : "s"} published`);
      if (b.length) {
        toast.warning(`${b.length} ${b.length === 1 ? "copy is" : "copies are"} still being checked — publish ${b.length === 1 ? "it" : "them"} after checking`);
        flagBlocked(b.map(x => x.id));
      }
      if (!n && !b.length) toast.info("No checked copies to publish.");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function publishOne(a: TeacherAttempt) {
    setBusy(a.id);
    try {
      const r = await publishResults({ submissionIds: [a.id] });
      if (r.blocked?.length) { toast.warning("This copy is still being checked — publish it after checking"); flagBlocked([a.id]); }
      else if (r.published?.length) toast.success("Result published");
      else toast.error("Couldn't publish.");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function confirmUnpublish() {
    if (!unpub) return;
    const reason = unpub.reason.trim();
    if (reason.length < 3) { toast.error("Enter a reason (at least 3 characters)"); return; }
    setBusy("unpub");
    try {
      const r = await unpublishResults(unpub.ids, reason);
      if (r.state !== "ok") throw new Error(r.message || "Couldn't unpublish.");
      toast.success("Result unpublished — the student no longer sees the marks");
      setUnpub(null);
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function retry(a: TeacherAttempt) {
    setBusy(a.id);
    try {
      const r = await retryChecks([a.id]);
      if (r.queued?.length) toast.success("Queued for checking again");
      else toast.error("Couldn't retry — this copy hasn't failed.");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function regrade() {
    if (!(await ask({ title: `Re-grade ${stale.length} ${stale.length === 1 ? "copy" : "copies"}?`, confirmLabel: "Re-grade",
      description: "They will be checked again with the new answer key. Published results are unpublished first. Old marks stay in the change history." }))) return;
    setBusy("regrade");
    try {
      const r = await regradeSubmissions(assignment.id, stale.map(a => a.id));
      const queued = Array.isArray(r.queued) ? r.queued.length : null;
      toast.success(queued != null ? `${queued} ${queued === 1 ? "copy" : "copies"} queued for re-grading` : "Re-grading started");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  function shareResult(row: StudentRow) {
    if (!settings) return;
    openWhatsApp(resultMessage(row.student.name, assignment.title, linkUrl(settings.link_token)), row.student.parent_phone);
  }

  function actions(a: TeacherAttempt, row: StudentRow) {
    const b = busy === a.id;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {a.sheet && <Button size="sm" variant="outline" onClick={() => setReviewing(a)}>Review</Button>}
        {["checked", "needs_review"].includes(a.status) && (
          <Button size="sm" className={BLACK_BTN} onClick={() => publishOne(a)} disabled={b}>{b ? <Spinner /> : "Publish"}</Button>
        )}
        {a.status === "published" && (
          <>
            <Button size="sm" variant="outline" onClick={() => setUnpub({ ids: [a.id], reason: "" })}>Unpublish</Button>
            <Button size="sm" variant="ghost" className="text-green-700" onClick={() => shareResult(row)} title="Share result on WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </>
        )}
        {a.status === "failed" && (
          <Button size="sm" className={BLACK_BTN} onClick={() => retry(a)} disabled={b}>{b ? <Spinner /> : "Check again"}</Button>
        )}
        {a.status === "waiting_key" && <Button size="sm" variant="outline" onClick={onEditAssignment}>Add answer key</Button>}
      </div>
    );
  }

  function statusCell(a: TeacherAttempt) {
    return (
      <div className="space-y-1">
        <ToneChip badge={teacherBadge(a.status)} />
        {a.status === "failed" && <p className="max-w-[220px] text-xs text-red-600">{a.job?.error || a.sheet?.error || "The check failed."}</p>}
        {a.status === "waiting_quota" && <p className="text-xs text-muted-foreground">Today's check limit is used up — it will be checked tomorrow</p>}
        {a.status === "waiting_key" && <p className="text-xs text-muted-foreground">Can't be checked without an answer key</p>}
        {a.status === "rejected" && a.reject_reasons[0] && <p className="max-w-[220px] text-xs text-red-600">{rejectText(a.reject_reasons[0])}</p>}
      </div>
    );
  }

  function chips(a: TeacherAttempt) {
    return (
      <div className="flex flex-wrap gap-1">
        {a.is_late && <Chip tone="amber">Late</Chip>}
        {isDup(a) && <Chip tone="red">Duplicate</Chip>}
        {(a.sheet?.needs_review_reasons || []).map(x => <Chip key={x} tone="violet">{REVIEW_LABEL[x] || x}</Chip>)}
      </div>
    );
  }

  if (loading && !settings) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Loading…</p>;
  if (error && !settings) {
    return (
      <div className="rounded-2xl border p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Button className={`mt-3 ${BLACK_BTN}`} onClick={() => load()}>Try again</Button>
      </div>
    );
  }
  if (!settings) return null;

  return (
    <div className="space-y-4" data-testid="copy-submissions">
      {dialog}
      <LinkSettingsCard assignmentId={assignment.id} title={assignment.title} settings={settings} onSaved={() => load(true)} />

      {stale.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-900/30" data-testid="regrade-banner">
          <p className="flex-1 text-sm"><b>The answer key changed. Re-grade older copies?</b> {stale.length} {stale.length === 1 ? "copy was" : "copies were"} checked with the old key.
            <span className="block text-xs text-muted-foreground">Old marks stay in the change history.</span></p>
          <Button className={BLACK_BTN} onClick={regrade} disabled={busy === "regrade"}>{busy === "regrade" ? <Spinner /> : "Re-grade"}</Button>
        </div>
      )}

      {!settings.upload_link_enabled && attempts.length === 0 ? null : (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-base font-bold">
              Copies <span className="text-sm font-normal text-muted-foreground">
                · {counts.students} students · {counts.pipeline} being checked · {counts.review} to review · {counts.published} published
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => load(true)} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            <Button className={BLACK_BTN} onClick={publishAll} disabled={busy === "all" || (counts.ready === 0 && counts.pipeline === 0)} data-testid="publish-all">
              {busy === "all" ? <Spinner /> : "Publish all"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className="h-9 rounded-md border bg-background px-2" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="Status filter">
              <option value="all">All statuses</option>
              <option value="pipeline">Being checked</option>
              <option value="checked">Checked</option>
              <option value="needs_review">Needs review</option>
              <option value="published">Published</option>
              <option value="problem">Failed / rejected</option>
            </select>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyReview} onChange={e => setOnlyReview(e.target.checked)} /> Needs review</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyLate} onChange={e => setOnlyLate(e.target.checked)} /> Late</label>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="copies-empty">
              No copies uploaded yet. Share the link on WhatsApp.
            </p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No copies match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm" data-testid="copies-table">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2">Student</th><th className="pr-2">Class</th><th className="pr-2">Attempt</th>
                    <th className="pr-2">Upload (IST)</th><th className="pr-2">Pages</th><th className="pr-2">Status</th>
                    <th className="pr-2">Marks</th><th className="pr-2">Flags</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(row => {
                    const a = row.counted!;
                    const open = expanded.has(row.student.id);
                    const others = row.attempts.filter(x => x.id !== a.id);
                    const rowCls = (x: TeacherAttempt) => highlight.has(x.id) ? "bg-amber-100 dark:bg-amber-900/40" : "";
                    return (
                      <Fragment key={row.student.id}>
                        <tr className={`border-b align-top ${rowCls(a)}`} data-testid="copy-row">
                          <td className="py-2 pr-2">
                            <button type="button" className="flex items-start gap-1 text-left font-semibold" disabled={!others.length}
                              onClick={() => setExpanded(s => {
                                const n = new Set(s);
                                if (n.has(row.student.id)) n.delete(row.student.id); else n.add(row.student.id);
                                return n;
                              })}>
                              {others.length ? (open ? <ChevronDown className="mt-0.5 h-4 w-4" /> : <ChevronRight className="mt-0.5 h-4 w-4" />) : <span className="w-4" />}
                              <span>{row.student.name}{row.student.roll_no && <span className="block text-xs font-normal text-muted-foreground">Roll {row.student.roll_no}</span>}</span>
                            </button>
                          </td>
                          <td className="pr-2">{row.student.class_level || assignment.batch_name || "—"}</td>
                          <td className="pr-2">Upload-{a.attempt_no}{others.length ? <span className="block text-xs text-muted-foreground">{row.attempts.length} attempts</span> : null}</td>
                          <td className="pr-2 whitespace-nowrap">{fmtIST(a.submitted_at)}</td>
                          <td className="pr-2">{pagesOf(a)}</td>
                          <td className="pr-2">{statusCell(a)}</td>
                          <td className="pr-2 font-semibold">{a.marks != null && a.sheet?.max_marks ? `${a.marks}/${a.sheet.max_marks}` : "—"}</td>
                          <td className="pr-2">{chips(a)}</td>
                          <td>{actions(a, row)}</td>
                        </tr>
                        {open && others.map(x => (
                          <tr key={x.id} className={`border-b bg-muted/40 align-top text-xs ${rowCls(x)}`}>
                            <td /><td /><td className="py-1.5 pr-2">Upload-{x.attempt_no}</td>
                            <td className="pr-2 whitespace-nowrap">{fmtIST(x.submitted_at)}</td><td className="pr-2">{pagesOf(x)}</td>
                            <td className="pr-2">{statusCell(x)}</td>
                            <td className="pr-2">{x.marks != null && x.sheet?.max_marks ? `${x.marks}/${x.sheet.max_marks}` : "—"}</td>
                            <td className="pr-2">{chips(x)}</td><td>{actions(x, row)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {settings.count_policy === "best" ? "Showing each student's best-scoring upload." : "Showing each student's latest upload."}
            {" "}Click a name to see older attempts.
          </p>
        </section>
      )}

      <ReviewDrawer attempt={reviewing} student={reviewing ? students[reviewing.student_id] || null : null}
        onClose={() => setReviewing(null)} onChanged={() => load(true)} />

      <AlertDialog open={!!unpub} onOpenChange={o => { if (!o) setUnpub(null); }}>
        <AlertDialogContent className="z-[80] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish this result?</AlertDialogTitle>
            <AlertDialogDescription>The student will stop seeing the marks. The reason is saved in the change history.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea autoFocus placeholder="Reason (e.g. the wrong key was used)" value={unpub?.reason || ""} maxLength={500}
            onChange={e => setUnpub(u => (u ? { ...u, reason: e.target.value } : u))} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={busy === "unpub"}
              onClick={e => { e.preventDefault(); confirmUnpublish(); }}>Unpublish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
