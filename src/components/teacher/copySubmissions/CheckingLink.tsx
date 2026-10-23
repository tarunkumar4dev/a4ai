// src/components/teacher/copySubmissions/CheckingLink.tsx
// "📸 Checking Link" for a test (generator result page, NCERT Test Builder, Test History ⋯ menu): save the test if
// needed → pick class + deadline (+ advanced link settings) → the class's assignment for this test is reused or
// created, paper + answer key attached, upload link switched on → link / WhatsApp / "Submissions dekho".

import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/AuthProvider";
import { useMyScope } from "@/hooks/useMyScope";
import { humanError } from "@/components/checker/checkerFetch";
import { fmtIST } from "@/lib/uploadFlow";
import { isoToIstInput, istInputToIso } from "@/lib/uploadLink/time";
import { linkUrl, shareLinkMessage } from "@/lib/uploadLink/teacher";
import {
  type TestLinkInfo, type TestRef, createOrReuseCheckingLink, defaultDeadlineIST, keyCoverage, submissionsHref, testLinks,
} from "@/lib/uploadLink/testLink";
import { fetchQuestionsForTest } from "@/utils/testPdfExporter";
import { openWhatsApp } from "@/lib/whatsapp";
import { Spinner } from "@/components/uploadLink/ui";

const FORMATS = [
  { mime: "application/pdf", label: "PDF" }, { mime: "image/jpeg", label: "JPG" },
  { mime: "image/png", label: "PNG" }, { mime: "image/webp", label: "WEBP" }, { mime: "image/heic", label: "HEIC" },
];
const DEFAULT_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** The button. `test` null = not saved yet → `ensureSaved` runs the page's existing save flow first. */
export function CheckingLinkButton({ test, ensureSaved, className, style }: {
  test: TestRef | null;
  ensureSaved?: () => Promise<TestRef | null>;
  className?: string;
  style?: CSSProperties;
}) {
  const [links, setLinks] = useState<TestLinkInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<TestRef | null>(test);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrent(test);
    if (!test?.id) { setLinks([]); return; }
    testLinks([test.id]).then(m => setLinks(m[test.id] || [])).catch(() => setLinks([]));
  }, [test?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function click() {
    let t = current;
    if (!t && ensureSaved) {
      setSaving(true);
      try { t = await ensureSaved(); } finally { setSaving(false); }
      if (!t) return;                                   // save failed / login needed — the save flow said why
      setCurrent(t);
    }
    if (t) setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={click} disabled={saving} className={className} style={style} data-testid="checking-link-btn">
        {saving ? <Spinner className="h-3.5 w-3.5" /> : <span aria-hidden>📸</span>}
        {links.length ? "Checking Link ✓" : "Checking Link"}
      </button>
      {current && (
        <CheckingLinkModal open={open} onOpenChange={setOpen} test={current} links={links}
          onLinked={l => setLinks(prev => [l, ...prev.filter(x => x.assignmentId !== l.assignmentId)])} />
      )}
    </>
  );
}

export function CheckingLinkModal({ open, onOpenChange, test, links, onLinked }: {
  open: boolean; onOpenChange: (o: boolean) => void; test: TestRef; links: TestLinkInfo[];
  onLinked: (l: TestLinkInfo) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scope = useMyScope();
  const [mode, setMode] = useState<"form" | "done">(links.length ? "done" : "form");
  const [done, setDone] = useState<TestLinkInfo | null>(links[0] || null);
  const [keyMissing, setKeyMissing] = useState(false);
  const [coverage, setCoverage] = useState<{ total: number; withKey: number } | null>(null);
  const [batchId, setBatchId] = useState("");
  const [deadline, setDeadline] = useState(isoToIstInput(defaultDeadlineIST()));
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [latePolicy, setLatePolicy] = useState<"accept_flag" | "reject">("accept_flag");
  const [autoPublish, setAutoPublish] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [maxMb, setMaxMb] = useState(10);
  const [maxPages, setMaxPages] = useState(30);
  const [mimes, setMimes] = useState<string[]>(DEFAULT_MIMES);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(links.length ? "done" : "form");
    setDone(links[0] || null);
    fetchQuestionsForTest(test.id, user?.id).then(qs => setCoverage(keyCoverage(qs))).catch(() => setCoverage(null));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!batchId && scope.batches.length === 1) setBatchId(scope.batches[0].id);
  }, [scope.batches, batchId]);

  async function confirm() {
    if (!user || !scope.instituteId) { toast.error("Checking link ke liye aapka institute se juda hona zaroori hai."); return; }
    if (!batchId) { toast.error("Class / section chuno."); return; }
    const deadlineIso = istInputToIso(deadline);
    if (deadlineIso && deadlineIso <= new Date().toISOString()) { toast.error("Deadline aage ki honi chahiye."); return; }
    setBusy(true);
    try {
      const r = await createOrReuseCheckingLink({
        test, userId: user.id, instituteId: scope.instituteId,
        choice: {
          batchId, deadline: deadlineIso,
          settings: { max_attempts: Math.min(20, Math.max(1, maxAttempts)), late_policy: latePolicy, auto_publish: autoPublish,
                      max_mb: Math.min(10, Math.max(1, maxMb)), max_pages: Math.min(30, Math.max(1, maxPages)),
                      allowed_mimes: mimes.length ? mimes : DEFAULT_MIMES, count_policy: "latest" },
        },
      });
      const info: TestLinkInfo = {
        assignmentId: r.assignmentId, token: r.token, deadline: deadlineIso, title: test.title,
        batchName: scope.batches.find(b => b.id === batchId)?.name ?? null,
      };
      onLinked(info);
      setDone(info);
      setKeyMissing(r.keyMissing);
      setMode("done");
      toast.success(r.reused ? "Is class ka link update ho gaya" : "Checking link ban gaya");
    } catch (e) {
      toast.error(humanError(e));
    }
    setBusy(false);
  }

  const url = done ? linkUrl(done.token) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success("Link copy ho gaya"); }
    catch { toast.error("Copy nahi hua — link ko select karke copy karo"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl" data-testid="checking-link-modal">
        <DialogHeader>
          <DialogTitle>📸 Checking Link</DialogTitle>
          <DialogDescription className="line-clamp-2">{test.title}</DialogDescription>
        </DialogHeader>

        {mode === "done" && done ? (
          <div className="space-y-4" data-testid="checking-link-done">
            {keyMissing && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800" role="alert">
                ⚠️ Answer key nahi hai, copies check nahi hongi. Assignment edit karke key add karo.
              </p>
            )}
            <div className="space-y-1 text-sm">
              <p><b>{done.batchName || "Class"}</b>{done.deadline ? <> · Deadline {fmtIST(done.deadline)}</> : null}</p>
              <div className="flex gap-2">
                <Input readOnly value={url} className="font-mono text-xs" onFocus={e => e.target.select()} data-testid="checking-link-url" />
                <Button variant="outline" size="sm" onClick={copy}><Copy className="mr-1 h-4 w-4" />Copy</Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="h-11 bg-green-600 text-white hover:bg-green-700"
                onClick={() => openWhatsApp(shareLinkMessage(done.title || test.title, url, done.deadline))}>
                <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp pe bhejo
              </Button>
              <Button variant="outline" className="h-11" onClick={() => { onOpenChange(false); navigate(submissionsHref(done.assignmentId)); }}>
                Submissions dekho
              </Button>
            </div>
            {links.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Is test ke baaki links</p>
                {links.filter(l => l.assignmentId !== done.assignmentId).map(l => (
                  <button key={l.assignmentId} type="button" className="block w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => setDone(l)}>{l.batchName || "Class"}{l.deadline ? ` · ${fmtIST(l.deadline)}` : ""}</button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setMode("form")}>+ Doosri class ke liye link</Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="checking-link-form">
            {coverage?.withKey === 0 && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800" role="alert" data-testid="key-warning">
                ⚠️ Answer key nahi hai, copies check nahi hongi.
              </p>
            )}
            {coverage && coverage.withKey > 0 && coverage.withKey < coverage.total && (
              <p className="text-xs text-muted-foreground">{coverage.total - coverage.withKey} questions ka answer nahi hai — AI unka scheme khud banayega.</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="cl-batch">Class / section</Label>
              {scope.loading ? <p className="text-sm text-muted-foreground"><Spinner /> Classes aa rahi hain…</p>
                : !scope.batches.length ? <p className="text-sm text-red-600">Aapki koi class nahi hai. Institute se judne ke baad link bana sakte ho.</p>
                : (
                  <select id="cl-batch" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={batchId}
                    onChange={e => setBatchId(e.target.value)}>
                    <option value="">Select batch</option>
                    {scope.batches.map(b => <option key={b.id} value={b.id}>{b.name} {b.class_level ? `(Class ${b.class_level})` : ""}</option>)}
                  </select>
                )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor="cl-deadline">Deadline (IST)</Label>
                <Input id="cl-deadline" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor="cl-att">Max attempts</Label>
                <Input id="cl-att" type="number" min={1} max={20} value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="cl-late">Deadline ke baad</Label>
                <select id="cl-late" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={latePolicy}
                  onChange={e => setLatePolicy(e.target.value as "accept_flag" | "reject")}>
                  <option value="accept_flag">Lo, par "Late" mark karo</option>
                  <option value="reject">Upload band</option>
                </select>
              </div>
              <label className="col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm"><b>Auto publish</b><br /><span className="text-xs text-muted-foreground">Saaf result turant student ko</span></span>
                <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
              </label>
            </div>

            <button type="button" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground" onClick={() => setAdvanced(a => !a)}>
              {advanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Advanced
            </button>
            {advanced && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="cl-mb">Max MB / file</Label>
                  <Input id="cl-mb" type="number" min={1} max={10} value={maxMb} onChange={e => setMaxMb(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label htmlFor="cl-pages">Max pages</Label>
                  <Input id="cl-pages" type="number" min={1} max={30} value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} /></div>
                <div className="col-span-2 flex flex-wrap gap-2">
                  {FORMATS.map(f => {
                    const on = mimes.includes(f.mime);
                    return (
                      <button key={f.mime} type="button" aria-pressed={on}
                        onClick={() => setMimes(m => (on ? m.filter(x => x !== f.mime) : [...m, f.mime]))}
                        className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button className="h-11 flex-1" onClick={confirm} disabled={busy || !batchId} data-testid="checking-link-confirm">
                {busy ? <><Spinner className="mr-2" /> Link ban raha hai…</> : "Link banao"}
              </Button>
              {links.length > 0 && <Button variant="ghost" className="h-11" onClick={() => setMode("done")}>Wapas</Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
