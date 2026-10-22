// src/components/teacher/copySubmissions/LinkSettingsCard.tsx
// "Submit link banao / settings" for one assignment (= the upload link, docs/upload-flow-api.md). Times are picked
// in IST and stored in UTC. Save → link + "WhatsApp pe bhejo".

import { useEffect, useState } from "react";
import { Copy, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type LinkSettings, linkUrl, saveLinkSettings, shareLinkMessage } from "@/lib/uploadLink/teacher";
import { isoToIstInput, istInputToIso } from "@/lib/uploadLink/time";
import { openWhatsApp } from "@/lib/whatsapp";
import { Spinner } from "@/components/uploadLink/ui";

const FORMATS: { mime: string; label: string }[] = [
  { mime: "application/pdf", label: "PDF" }, { mime: "image/jpeg", label: "JPG" },
  { mime: "image/png", label: "PNG" }, { mime: "image/webp", label: "WEBP" }, { mime: "image/heic", label: "HEIC" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v || lo)));

export default function LinkSettingsCard({ assignmentId, title, settings, onSaved }: {
  assignmentId: string; title: string; settings: LinkSettings; onSaved: () => void;
}) {
  const [s, setS] = useState(settings);
  const [opensAt, setOpensAt] = useState(isoToIstInput(settings.opens_at));
  const [deadline, setDeadline] = useState(isoToIstInput(settings.deadline));
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(!settings.upload_link_enabled);
  useEffect(() => {
    setS(settings);
    setOpensAt(isoToIstInput(settings.opens_at));
    setDeadline(isoToIstInput(settings.deadline));
  }, [settings]);

  const set = <K extends keyof LinkSettings>(k: K, v: LinkSettings[K]) => setS(x => ({ ...x, [k]: v }));
  const url = linkUrl(s.link_token);

  async function save(enable?: boolean) {
    const opens = istInputToIso(opensAt), closes = istInputToIso(deadline);
    if (opens && closes && opens >= closes) { toast.error("Opening time deadline se pehle hona chahiye."); return; }
    if (!s.allowed_mimes.length) { toast.error("Kam se kam ek format chuno."); return; }
    setSaving(true);
    try {
      await saveLinkSettings(assignmentId, {
        upload_link_enabled: enable ?? s.upload_link_enabled,
        status: s.status, opens_at: opens, deadline: closes,
        max_attempts: clamp(s.max_attempts, 1, 20), max_mb: clamp(s.max_mb, 1, 10), max_pages: clamp(s.max_pages, 1, 30),
        allowed_mimes: s.allowed_mimes, late_policy: s.late_policy, count_policy: s.count_policy, auto_publish: s.auto_publish,
      });
      toast.success(enable ? "Upload link on ho gaya" : "Settings save ho gayi");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save nahi hua");
    }
    setSaving(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success("Link copy ho gaya"); }
    catch { toast.error("Copy nahi hua — link ko select karke copy karo"); }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-4" data-testid="link-settings">
      <div className="flex flex-wrap items-center gap-3">
        <Link2 className="h-5 w-5 text-primary" />
        <h3 className="text-base font-bold flex-1">Copy upload link</h3>
        {settings.upload_link_enabled
          ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">On</span>
          : <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Off</span>}
        {settings.upload_link_enabled && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)}>{open ? "Settings band karo" : "Settings"}</Button>
        )}
      </div>

      {settings.upload_link_enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Input readOnly value={url} className="min-w-0 flex-1 font-mono text-xs" onFocus={e => e.target.select()} data-testid="link-url" />
          <Button variant="outline" size="sm" onClick={copy}><Copy className="mr-1 h-4 w-4" /> Copy</Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => openWhatsApp(shareLinkMessage(title, url, settings.deadline))}>
            <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp pe bhejo
          </Button>
        </div>
      )}

      {open && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ls-open">Upload kab se (IST)</Label>
            <Input id="ls-open" type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">Khaali = abhi se</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ls-deadline">Deadline (IST)</Label>
            <Input id="ls-deadline" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
            <p className="text-xs text-muted-foreground">2 min ki grace milti hai</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ls-att">Max attempts</Label>
            <Input id="ls-att" type="number" min={1} max={20} value={s.max_attempts} onChange={e => set("max_attempts", Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ls-mb">Max MB / file</Label>
              <Input id="ls-mb" type="number" min={1} max={10} value={s.max_mb} onChange={e => set("max_mb", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ls-pages">Max pages</Label>
              <Input id="ls-pages" type="number" min={1} max={30} value={s.max_pages} onChange={e => set("max_pages", Number(e.target.value))} />
            </div>
          </div>
          <fieldset className="space-y-1 sm:col-span-2">
            <legend className="text-sm font-medium">Allowed formats</legend>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => {
                const on = s.allowed_mimes.includes(f.mime);
                return (
                  <button key={f.mime} type="button" aria-pressed={on}
                    onClick={() => set("allowed_mimes", on ? s.allowed_mimes.filter(m => m !== f.mime) : [...s.allowed_mimes, f.mime])}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}>
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">iPhone ki HEIC photo browser mein hi JPG ban jaati hai — JPG on rakhein.</p>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="ls-late">Deadline ke baad</Label>
            <select id="ls-late" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={s.late_policy}
              onChange={e => set("late_policy", e.target.value as LinkSettings["late_policy"])}>
              <option value="accept_flag">Lo, par "Late" mark karo</option>
              <option value="reject">Upload band</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ls-count">Kaunsa attempt count ho</Label>
            <select id="ls-count" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={s.count_policy}
              onChange={e => set("count_policy", e.target.value as LinkSettings["count_policy"])}>
              <option value="latest">Aakhri upload (default)</option>
              <option value="best">Sabse achhe marks</option>
            </select>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm"><b>Auto publish</b><br /><span className="text-xs text-muted-foreground">Saaf result turant student ko (review wale nahi)</span></span>
            <Switch checked={s.auto_publish} onCheckedChange={v => set("auto_publish", v)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm"><b>Link active</b><br /><span className="text-xs text-muted-foreground">Off = students ko "upload band" dikhega</span></span>
            <Switch checked={s.status === "active"} onCheckedChange={v => set("status", v ? "active" : "closed")} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {settings.upload_link_enabled ? (
              <>
                <Button onClick={() => save()} disabled={saving}>{saving ? <Spinner /> : "Save"}</Button>
                <Button variant="outline" onClick={() => save(false)} disabled={saving}>Upload link band karo</Button>
              </>
            ) : (
              <Button onClick={() => save(true)} disabled={saving} data-testid="enable-link">{saving ? <Spinner /> : "Submit link banao"}</Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
