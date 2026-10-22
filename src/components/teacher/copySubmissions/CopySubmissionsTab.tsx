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
    if (!(await ask({ title: "Sab publish karein?", confirmLabel: "Publish karo",
      description: "Jo copies check ho chuki hain unke marks students ko dikhne lagenge. Jo abhi check ho rahi hain wo baad mein publish hongi." }))) return;
    setBusy("all");
    try {
      const r = await publishResults({ assignmentId: assignment.id });
      if (r.state !== "ok") throw new Error(r.state === "forbidden" ? "Aapko is assignment ka access nahi hai." : "Publish nahi hua.");
      const n = r.published?.length || 0, b = r.blocked || [];
      if (n) toast.success(`${n} result publish ho gaye`);
      if (b.length) {
        toast.warning(`${b.length} copies abhi check ho rahi hain, unke baad publish hongi`);
        flagBlocked(b.map(x => x.id));
      }
      if (!n && !b.length) toast.info("Publish karne ke liye koi checked copy nahi hai.");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function publishOne(a: TeacherAttempt) {
    setBusy(a.id);
    try {
      const r = await publishResults({ submissionIds: [a.id] });
      if (r.blocked?.length) { toast.warning("Ye copy abhi check ho rahi hai, uske baad publish hogi"); flagBlocked([a.id]); }
      else if (r.published?.length) toast.success("Result publish ho gaya");
      else toast.error("Publish nahi hua.");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function confirmUnpublish() {
    if (!unpub) return;
    const reason = unpub.reason.trim();
    if (reason.length < 3) { toast.error("Wajah likho (kam se kam 3 akshar)"); return; }
    setBusy("unpub");
    try {
      const r = await unpublishResults(unpub.ids, reason);
      if (r.state !== "ok") throw new Error(r.message || "Unpublish nahi hua.");
      toast.success("Result hata diya — student ko ab marks nahi dikhenge");
      setUnpub(null);
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function retry(a: TeacherAttempt) {
    setBusy(a.id);
    try {
      const r = await retryChecks([a.id]);
      if (r.queued?.length) toast.success("Dobara check ke liye queue mein daal diya");
      else toast.error("Retry nahi hua — copy abhi failed status mein nahi hai.");
      await load(true);
    } catch (e) { toast.error(humanError(e)); }
    setBusy(null);
  }

  async function regrade() {
    if (!(await ask({ title: `${stale.length} copies re-grade karein?`, confirmLabel: "Re-grade karo",
      description: "Nayi answer key se dobara check hoga. Published results pehle unpublish honge. Purane marks change history (audit) mein rahenge." }))) return;
    setBusy("regrade");
    try {
      const r = await regradeSubmissions(assignment.id, stale.map(a => a.id));
      const queued = Array.isArray(r.queued) ? r.queued.length : null;
      toast.success(queued != null ? `${queued} copies re-grade ke liye queue mein` : "Re-grade shuru ho gaya");
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
          <Button size="sm" onClick={() => publishOne(a)} disabled={b}>{b ? <Spinner /> : "Publish"}</Button>
        )}
        {a.status === "published" && (
          <>
            <Button size="sm" variant="outline" onClick={() => setUnpub({ ids: [a.id], reason: "" })}>Unpublish</Button>
            <Button size="sm" variant="ghost" className="text-green-700" onClick={() => shareResult(row)} title="Result WhatsApp pe bhejo">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </>
        )}
        {a.status === "failed" && (
          <Button size="sm" variant="destructive" onClick={() => retry(a)} disabled={b}>{b ? <Spinner /> : "Dobara check karo"}</Button>
        )}
        {a.status === "waiting_key" && <Button size="sm" variant="outline" onClick={onEditAssignment}>Answer key add karo</Button>}
      </div>
    );
  }

  function statusCell(a: TeacherAttempt) {
    return (
      <div className="space-y-1">
        <ToneChip badge={teacherBadge(a.status)} />
        {a.status === "failed" && <p className="max-w-[220px] text-xs text-red-600">{a.job?.error || a.sheet?.error || "Check fail ho gaya."}</p>}
        {a.status === "waiting_quota" && <p className="text-xs text-muted-foreground">Aaj ki check limit poori, kal auto check hoga</p>}
        {a.status === "waiting_key" && <p className="text-xs text-muted-foreground">Answer key ke bina check nahi hoga</p>}
        {a.status === "rejected" && a.reject_reasons[0] && <p className="max-w-[220px] text-xs text-red-600">{a.reject_reasons[0].message}</p>}
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

  if (loading && !settings) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Load ho raha hai…</p>;
  if (error && !settings) {
    return (
      <div className="rounded-2xl border p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Button className="mt-3" onClick={() => load()}>Dobara try karo</Button>
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
          <p className="flex-1 text-sm"><b>Key badli hai, purani copies re-grade karein?</b> {stale.length} copies purani answer key se check hui hain.
            <span className="block text-xs text-muted-foreground">Purane marks change history (audit) mein rahenge.</span></p>
          <Button onClick={regrade} disabled={busy === "regrade"}>{busy === "regrade" ? <Spinner /> : "Re-grade karo"}</Button>
        </div>
      )}

      {!settings.upload_link_enabled && attempts.length === 0 ? null : (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-base font-bold">
              Copies <span className="text-sm font-normal text-muted-foreground">
                · {counts.students} students · {counts.pipeline} check mein · {counts.review} review · {counts.published} published
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => load(true)} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={publishAll} disabled={busy === "all" || (counts.ready === 0 && counts.pipeline === 0)} data-testid="publish-all">
              {busy === "all" ? <Spinner /> : "Sab publish karo"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className="h-9 rounded-md border bg-background px-2" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} aria-label="Status filter">
              <option value="all">Sab status</option>
              <option value="pipeline">Check ho rahe</option>
              <option value="checked">Checked</option>
              <option value="needs_review">Review chahiye</option>
              <option value="published">Published</option>
              <option value="problem">Fail / reject</option>
            </select>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyReview} onChange={e => setOnlyReview(e.target.checked)} /> Needs review</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyLate} onChange={e => setOnlyLate(e.target.checked)} /> Late</label>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="copies-empty">
              Abhi kisi student ne copy upload nahi ki. Link WhatsApp pe bhejo.
            </p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Is filter mein koi copy nahi.</p>
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
            {settings.count_policy === "best" ? "Har student ka sabse achhe marks wala upload dikh raha hai." : "Har student ka aakhri upload dikh raha hai."}
            {" "}Purane attempts dekhne ke liye naam pe click karo.
          </p>
        </section>
      )}

      <ReviewDrawer attempt={reviewing} student={reviewing ? students[reviewing.student_id] || null : null}
        onClose={() => setReviewing(null)} onChanged={() => load(true)} />

      <AlertDialog open={!!unpub} onOpenChange={o => { if (!o) setUnpub(null); }}>
        <AlertDialogContent className="z-[80] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Result unpublish karein?</AlertDialogTitle>
            <AlertDialogDescription>Student ko marks dikhna band ho jayega. Wajah change history mein save hogi.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea autoFocus placeholder="Wajah (jaise: galat key lagi thi)" value={unpub?.reason || ""} maxLength={500}
            onChange={e => setUnpub(u => (u ? { ...u, reason: e.target.value } : u))} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={busy === "unpub"}
              onClick={e => { e.preventDefault(); confirmUnpublish(); }}>Unpublish karo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
