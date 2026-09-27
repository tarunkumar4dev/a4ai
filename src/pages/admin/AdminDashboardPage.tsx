// src/pages/admin/AdminDashboardPage.tsx
// a4ai — HOD Dashboard (served at /admin for now; will move to /hod)
//
// HOD sees ONLY their department:
//   Department → Sections (create / delete, assign Proctor)
//             → Section detail (assign subject teachers, lab batches A/B/C)
// Institute owner/admin can open it too and pick any department (preview mode).
//
// ID conventions (matches InstituteDashboardPage):
//   teaching_assignments.teacher_id = auth user_id
//   teacher_batches.teacher_id      = auth user_id
//   proctor_assignments.teacher_id  = see PROCTOR_ID_FIELD below

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Building2, Users, GraduationCap, Layers, ChevronRight, Plus, Shield,
  BookOpen, AlertCircle, X, Loader2, LogOut, Trash2, CalendarCheck, FlaskConical,
} from "lucide-react";

// ⚠️ Verify against ProctorSectionView before relying on it.
// If ProctorSectionView looks up proctor_assignments by institute_members.id,
// change this to "id". Display below matches BOTH, only the insert depends on it.
const PROCTOR_ID_FIELD: "user_id" | "id" = "user_id";

// ============================================================
// TYPES
// ============================================================
interface Member {
  id: string; user_id: string; role: string; department_id: string | null;
  user_name: string | null; user_email: string | null;
}
interface Dept { id: string; name: string; student_code: string; teacher_code: string; }
interface Section { id: string; department_id: string; name: string; year: number | null; }
interface Batch { id: string; name: string; section_id: string | null; }
interface Subject { id: string; name: string; code: string | null; department_id: string | null; }
interface TA { teacher_id: string; batch_id: string; subject_id: string; }
interface Proctor { teacher_id: string; section_id: string; }
interface Stu { id: string; section_id: string | null; batch_id: string | null; }

// ============================================================
// STYLES
// ============================================================
const styles = `
  .hod-scope { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
  .hod-card { background: rgba(255,255,255,.9); border: 1px solid rgba(0,0,0,.06); border-radius: 16px; transition: all .2s ease; }
  .dark .hod-card { background: rgba(40,40,45,.85); border-color: rgba(255,255,255,.08); }
  .hod-hover:hover { transform: translateY(-2px); border-color: #f97316; box-shadow: 0 12px 28px rgba(249,115,22,.18); }
  .hod-btn { background: linear-gradient(135deg,#f97316,#ea580c); color: #fff; box-shadow: 0 4px 14px rgba(249,115,22,.3); transition: all .2s; }
  .hod-btn:hover { transform: translateY(-1px); }
  .hod-btn:disabled { opacity: .5; transform: none; }
  .hod-field { width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid #e5e7eb; background: #fff; font-size: 14px; outline: none; }
  .hod-field:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,.12); }
  .dark .hod-field { background: #1f2937; border-color: #374151; color: #f3f4f6; }
  .hod-fade { animation: hodFade .3s ease-out; }
  @keyframes hodFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
`;

// ============================================================
// HELPERS
// ============================================================
const nameOf = (m?: Member | null) => m?.user_name || m?.user_email?.split("@")[0] || "Unnamed";
const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "?";

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => (
  <div className="rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold flex items-center justify-center flex-shrink-0"
    style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials(name)}</div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
    <div className="hod-card w-full max-w-md p-6 hod-fade bg-white dark:bg-gray-900" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="hod-card p-4">
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center mb-3">{icon}</div>
    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{label}</div>
    {hint && <div className="text-[11px] text-amber-600 mt-1">{hint}</div>}
  </div>
);

/** Teacher picker with search. Department teachers are listed first. */
const TeacherPicker: React.FC<{
  members: Member[]; deptId: string; onPick: (m: Member) => void; busy?: boolean;
}> = ({ members, deptId, onPick, busy }) => {
  const [q, setQ] = useState("");
  const list = members
    .filter(m => ["teacher", "hod"].includes(m.role))
    .filter(m => (nameOf(m) + " " + (m.user_email || "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.department_id === deptId) - Number(a.department_id === deptId));
  return (
    <>
      <input className="hod-field mb-3" placeholder="Search teacher…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <div className="max-h-72 overflow-y-auto space-y-1">
        {list.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No teachers found. Teachers join using the institute code.</p>}
        {list.map(m => (
          <button key={m.id} disabled={busy} onClick={() => onPick(m)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 text-left disabled:opacity-50">
            <Avatar name={nameOf(m)} size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{nameOf(m)}</div>
              <div className="text-xs text-gray-500 truncate">{m.user_email}</div>
            </div>
            {m.department_id === deptId && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">This dept</span>}
          </button>
        ))}
      </div>
    </>
  );
};

// ============================================================
// MAIN
// ============================================================
const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // context
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [instId, setInstId] = useState<string | null>(null);
  const [instName, setInstName] = useState("");
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [allDepts, setAllDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);

  // department data
  const [loading, setLoading] = useState(false);
  const [dept, setDept] = useState<Dept | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tas, setTas] = useState<TA[]>([]);
  const [proctors, setProctors] = useState<Proctor[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<Stu[]>([]);

  // navigation + modals
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "section" | "proctor" | "subject" | "batch">(null);
  const [busy, setBusy] = useState(false);
  const [newSection, setNewSection] = useState({ name: "", year: "" });
  const [newBatchName, setNewBatchName] = useState("");
  const [subjForm, setSubjForm] = useState<{ subjectId: string; newName: string; teacher: Member | null }>({ subjectId: "", newName: "", teacher: null });

  // ---------------- BOOT: who am I, which department ----------------
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) { navigate("/login"); return; }

        const { data: mem } = await supabase
          .from("institute_members")
          .select("institute_id, role, department_id")
          .eq("user_id", uid).eq("status", "active");

        const hodRow = (mem || []).find((m: any) => m.role === "hod" && m.department_id);
        let institute: string | null = null;
        let myDept: string | null = null;
        let adminMode = false;

        if (hodRow) {
          institute = hodRow.institute_id; myDept = hodRow.department_id;
        } else {
          const { data: owned } = await supabase.from("institutes").select("id").eq("owner_id", uid).limit(1);
          const adminRow = (mem || []).find((m: any) => ["admin", "institute"].includes(m.role));
          institute = owned?.[0]?.id || adminRow?.institute_id || null;
          adminMode = !!institute;
        }

        if (!institute) {
          setBootError("You are not assigned as HOD of any department yet. Ask your administrator to assign you.");
          return;
        }

        const [{ data: inst }, { data: depts }] = await Promise.all([
          supabase.from("institutes").select("id, name").eq("id", institute).single(),
          supabase.from("departments").select("id, name, student_code, teacher_code").eq("institute_id", institute).order("name"),
        ]);

        setInstId(institute);
        setInstName(inst?.name || "Institute");
        setAllDepts(depts || []);
        setIsAdminPreview(adminMode);
        setDeptId(myDept || depts?.[0]?.id || null);
        if (!myDept && !depts?.length) setBootError("No departments exist yet. Create one from the Institute dashboard.");
      } catch (e: any) {
        console.error(e);
        setBootError(e.message || "Failed to load");
      } finally {
        setBootLoading(false);
      }
    })();
  }, [navigate]);

  // ---------------- LOAD DEPARTMENT (everything in one pass) ----------------
  const loadDept = useCallback(async () => {
    if (!instId || !deptId) return;
    setLoading(true);
    try {
      const [d, secs, subj, mems, stus] = await Promise.all([
        supabase.from("departments").select("id, name, student_code, teacher_code").eq("id", deptId).single(),
        supabase.from("sections").select("id, department_id, name, year").eq("department_id", deptId).order("name"),
        supabase.from("subjects").select("id, name, code, department_id").eq("institute_id", instId).order("name"),
        supabase.from("institute_members").select("id, user_id, role, department_id, user_name, user_email")
          .eq("institute_id", instId).eq("status", "active"),
        supabase.from("students").select("id, section_id, batch_id").eq("institute_id", instId).eq("is_active", true),
      ]);
      const secList: Section[] = secs.data || [];
      const secIds = secList.map(s => s.id);
      const NONE = ["00000000-0000-0000-0000-000000000000"];

      const { data: bat } = await supabase.from("batches").select("id, name, section_id")
        .in("section_id", secIds.length ? secIds : NONE).eq("is_active", true).order("name");
      const batIds = (bat || []).map(b => b.id);

      const [ta, pa] = await Promise.all([
        supabase.from("teaching_assignments").select("teacher_id, batch_id, subject_id")
          .in("batch_id", batIds.length ? batIds : NONE).eq("is_active", true),
        supabase.from("proctor_assignments").select("teacher_id, section_id")
          .in("section_id", secIds.length ? secIds : NONE).eq("is_active", true),
      ]);

      setDept(d.data || null);
      setSections(secList);
      setBatches(bat || []);
      setSubjects((subj.data || []).filter((s: Subject) => !s.department_id || s.department_id === deptId));
      setMembers(mems.data || []);
      setStudents(stus.data || []);
      setTas(ta.data || []);
      setProctors(pa.data || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Couldn't load department");
    } finally {
      setLoading(false);
    }
  }, [instId, deptId]);

  useEffect(() => { loadDept(); setOpenSectionId(null); }, [loadDept]);

  // ---------------- DERIVED ----------------
  const memberById = useCallback((tid: string) => members.find(m => m.user_id === tid || m.id === tid) || null, [members]);
  const batchSection = useMemo(() => Object.fromEntries(batches.map(b => [b.id, b.section_id])), [batches]);
  const sectionOfStudent = (s: Stu) => s.section_id || (s.batch_id ? batchSection[s.batch_id] : null) || null;

  const perSection = useMemo(() => {
    const out: Record<string, { students: number; batches: Batch[]; proctor: Member | null; subjects: number; teachers: number }> = {};
    sections.forEach(s => {
      const secBatches = batches.filter(b => b.section_id === s.id);
      const bIds = new Set(secBatches.map(b => b.id));
      const secTas = tas.filter(t => bIds.has(t.batch_id));
      const p = proctors.find(p => p.section_id === s.id);
      out[s.id] = {
        students: students.filter(st => sectionOfStudent(st) === s.id).length,
        batches: secBatches,
        proctor: p ? memberById(p.teacher_id) : null,
        subjects: new Set(secTas.map(t => t.subject_id)).size,
        teachers: new Set(secTas.map(t => t.teacher_id)).size,
      };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, batches, tas, proctors, students, memberById]);

  const deptStudents = sections.reduce((n, s) => n + (perSection[s.id]?.students || 0), 0);
  const deptTeachers = useMemo(() => {
    const ids = new Set(members.filter(m => m.department_id === deptId && ["teacher", "hod"].includes(m.role)).map(m => m.user_id));
    tas.forEach(t => ids.add(t.teacher_id));
    return ids.size;
  }, [members, tas, deptId]);
  const proctorCount = sections.filter(s => perSection[s.id]?.proctor).length;
  const hod = members.find(m => m.role === "hod" && m.department_id === deptId) || null;

  const openSection = sections.find(s => s.id === openSectionId) || null;

  /** Subject-teacher rows for the open section, grouped by subject+teacher */
  const sectionTeaching = useMemo(() => {
    if (!openSection) return [];
    const bIds = new Set(batches.filter(b => b.section_id === openSection.id).map(b => b.id));
    const map = new Map<string, { subject: Subject | undefined; teacher: Member | null; teacherId: string; subjectId: string; batchIds: string[] }>();
    tas.filter(t => bIds.has(t.batch_id)).forEach(t => {
      const key = t.subject_id + "|" + t.teacher_id;
      if (!map.has(key)) map.set(key, {
        subject: subjects.find(s => s.id === t.subject_id), teacher: memberById(t.teacher_id),
        teacherId: t.teacher_id, subjectId: t.subject_id, batchIds: [],
      });
      map.get(key)!.batchIds.push(t.batch_id);
    });
    return [...map.values()].sort((a, b) => (a.subject?.name || "").localeCompare(b.subject?.name || ""));
  }, [openSection, batches, tas, subjects, memberById]);

  // ---------------- ACTIONS ----------------
  const createSection = async () => {
    if (!newSection.name.trim() || !deptId) return;
    setBusy(true);
    const { data, error } = await supabase.from("sections")
      .insert({ department_id: deptId, name: newSection.name.trim(), year: newSection.year ? parseInt(newSection.year) : null })
      .select("id").single();
    if (error) { setBusy(false); return toast.error(error.message); }

    // Every section gets a default "main" batch so subject assignments + attendance have somewhere to attach
    // until Phase 1 moves them to section level.
    await supabase.from("batches").insert({
      institute_id: instId, name: newSection.name.trim(), department_id: deptId, section_id: data.id,
    });
    toast.success(`Section ${newSection.name.trim()} created`);
    setNewSection({ name: "", year: "" }); setModal(null); setBusy(false);
    loadDept();
  };

  const deleteSection = async (s: Section) => {
    if (!confirm(`Delete section ${s.name}? Students stay in the institute but lose this section.`)) return;
    const { error } = await supabase.from("sections").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Section deleted");
    if (openSectionId === s.id) setOpenSectionId(null);
    loadDept();
  };

  const assignProctor = async (m: Member) => {
    if (!openSectionId || !instId || !deptId) return;
    setBusy(true);
    await supabase.from("proctor_assignments").update({ is_active: false }).eq("section_id", openSectionId);
    const { error } = await supabase.from("proctor_assignments").insert({
      institute_id: instId, department_id: deptId, section_id: openSectionId,
      teacher_id: m[PROCTOR_ID_FIELD], is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${nameOf(m)} is now class teacher`);
    setModal(null); loadDept();
  };

  const assignSubjectTeacher = async () => {
    const { subjectId, newName, teacher } = subjForm;
    if (!openSection || !instId || !teacher || (!subjectId && !newName.trim())) return;
    const secBatches = batches.filter(b => b.section_id === openSection.id);
    if (secBatches.length === 0) return toast.error("This section has no batch yet. Add a batch first.");
    setBusy(true);
    try {
      let sid = subjectId;
      if (!sid) {
        const name = newName.trim();
        const existing = subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) sid = existing.id;
        else {
          const code = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() + "101";
          const { data, error } = await supabase.from("subjects")
            .insert({ institute_id: instId, name, code, department_id: deptId, is_active: true })
            .select("id").single();
          if (error) throw error;
          sid = data.id;
        }
      }
      // Attach teacher+subject to every batch of the section (section-level until Phase 1)
      for (const b of secBatches) {
        const { error } = await supabase.from("teaching_assignments").insert({
          institute_id: instId, teacher_id: teacher.user_id, batch_id: b.id, subject_id: sid,
        });
        if (error && error.code !== "23505") throw error;
      }
      toast.success(`${nameOf(teacher)} assigned`);
      setSubjForm({ subjectId: "", newName: "", teacher: null }); setModal(null);
      loadDept();
    } catch (e: any) {
      toast.error(e.message || "Failed to assign");
    } finally { setBusy(false); }
  };

  const removeSubjectTeacher = async (teacherId: string, subjectId: string, batchIds: string[]) => {
    if (!confirm("Remove this teacher from this subject in this section?")) return;
    const { error } = await supabase.from("teaching_assignments").delete()
      .eq("teacher_id", teacherId).eq("subject_id", subjectId).in("batch_id", batchIds);
    if (error) return toast.error(error.message);
    toast.success("Removed"); loadDept();
  };

  const createBatch = async () => {
    if (!openSection || !newBatchName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("batches").insert({
      institute_id: instId, name: newBatchName.trim(), department_id: deptId, section_id: openSection.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Batch added"); setNewBatchName(""); setModal(null); loadDept();
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (bootLoading) {
    return (
      <div className="hod-scope min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <style>{styles}</style>
        <Loader2 className="w-9 h-9 animate-spin text-orange-500" />
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="hod-scope min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <style>{styles}</style>
        <div className="hod-card p-8 max-w-md text-center">
          <AlertCircle className="w-11 h-11 mx-auto text-orange-500 mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">HOD access not available</h2>
          <p className="text-sm text-gray-600 mb-4">{bootError}</p>
          <button onClick={() => navigate("/teacher/dashboard")} className="hod-btn px-4 py-2 rounded-xl text-sm font-semibold">Go to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hod-scope min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-900 dark:to-orange-950/20">
      <style>{styles}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-orange-100 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">{dept?.name || "Department"} · HOD Dashboard</h1>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider truncate">{instName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdminPreview && (
              <select className="hod-field !py-1.5 !w-auto text-xs" value={deptId || ""} onChange={e => setDeptId(e.target.value)}>
                {allDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <button title="Logout" onClick={() => supabase.auth.signOut().then(() => navigate("/login"))}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isAdminPreview && (
          <div className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
            Admin preview: you're seeing what the HOD of this department sees.
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm">
          <button onClick={() => setOpenSectionId(null)} className={openSection ? "text-orange-600 hover:underline font-medium" : "font-medium text-gray-900 dark:text-gray-100"}>
            {dept?.name}
          </button>
          {openSection && (<><ChevronRight className="w-3.5 h-3.5 text-gray-400" /><span className="font-medium text-gray-900 dark:text-gray-100">{openSection.name}</span></>)}
        </nav>

        {loading && !dept ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" /></div>
        ) : !openSection ? (
          /* ================= DEPARTMENT VIEW ================= */
          <div className="space-y-6 hod-fade">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon={<Layers className="w-4 h-4" />} label="Sections" value={sections.length} />
              <Stat icon={<Shield className="w-4 h-4" />} label="Class teachers" value={`${proctorCount}/${sections.length}`}
                hint={proctorCount < sections.length ? `${sections.length - proctorCount} unassigned` : undefined} />
              <Stat icon={<GraduationCap className="w-4 h-4" />} label="Teachers" value={deptTeachers} />
              <Stat icon={<Users className="w-4 h-4" />} label="Students" value={deptStudents} />
            </div>

            {isAdminPreview && (
              <div className="hod-card p-4 flex items-center gap-3">
                {hod ? <Avatar name={nameOf(hod)} /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                <div className="text-sm">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{hod ? nameOf(hod) : "No HOD assigned"}</div>
                  <div className="text-xs text-gray-500">{hod ? "Head of Department" : "Assign one from the Institute dashboard → Departments"}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sections</h2>
              <button onClick={() => setModal("section")} className="hod-btn px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> New section
              </button>
            </div>

            {sections.length === 0 ? (
              <div className="hod-card p-10 text-center">
                <Layers className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600">No sections yet. Create {dept?.name}-1, {dept?.name}-2 …</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map(s => {
                  const info = perSection[s.id];
                  return (
                    <div key={s.id} onClick={() => setOpenSectionId(s.id)} className="hod-card hod-hover p-5 cursor-pointer group">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-gray-100">{s.name}</h3>
                          {s.year && <p className="text-xs text-gray-500">Year {s.year}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); deleteSection(s); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 p-2.5 rounded-xl text-sm ${info?.proctor ? "bg-gray-50 dark:bg-gray-800" : "border-2 border-dashed border-amber-300 bg-amber-50/60 text-amber-700"}`}>
                        {info?.proctor
                          ? (<><Avatar name={nameOf(info.proctor)} size={26} /><span className="truncate font-medium text-gray-800 dark:text-gray-200">{nameOf(info.proctor)}</span><span className="ml-auto text-[10px] text-gray-500">Class teacher</span></>)
                          : (<><AlertCircle className="w-4 h-4" /> No class teacher</>)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-center">
                        {[["Subjects", info?.subjects], ["Teachers", info?.teachers], ["Students", info?.students]].map(([l, v]) => (
                          <div key={l as string}><div className="text-lg font-bold text-gray-900 dark:text-gray-100">{v || 0}</div><div className="text-[10px] text-gray-500 uppercase tracking-wider">{l}</div></div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="hod-card p-5 flex items-center gap-3 text-sm text-gray-600">
              <CalendarCheck className="w-5 h-5 text-orange-500 flex-shrink-0" />
              Daily / monthly attendance per section will appear here after the database update (Phase 1).
            </div>
          </div>
        ) : (
          /* ================= SECTION VIEW ================= */
          <div className="space-y-6 hod-fade">
            <div className="hod-card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{openSection.name}</h2>
                  <p className="text-xs text-gray-500">{dept?.name}{openSection.year ? ` · Year ${openSection.year}` : ""} · {perSection[openSection.id]?.students || 0} students</p>
                </div>
                <button onClick={() => setModal("proctor")} className="px-3 py-2 rounded-xl text-sm font-semibold border border-orange-200 text-orange-700 hover:bg-orange-50 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> {perSection[openSection.id]?.proctor ? "Change class teacher" : "Assign class teacher"}
                </button>
              </div>
              {perSection[openSection.id]?.proctor && (
                <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <Avatar name={nameOf(perSection[openSection.id].proctor)} />
                  <div className="text-sm"><div className="font-semibold text-gray-900 dark:text-gray-100">{nameOf(perSection[openSection.id].proctor)}</div><div className="text-xs text-gray-500">Class teacher (proctor)</div></div>
                </div>
              )}
            </div>

            {/* Subject teachers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Subjects & teachers</h3>
                <button onClick={() => setModal("subject")} className="hod-btn px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Assign</button>
              </div>
              {sectionTeaching.length === 0 ? (
                <div className="hod-card p-8 text-center text-sm text-gray-600"><BookOpen className="w-9 h-9 mx-auto text-gray-400 mb-2" />No subjects assigned in this section yet.</div>
              ) : (
                <div className="space-y-2">
                  {sectionTeaching.map(r => (
                    <div key={r.subjectId + r.teacherId} className="hod-card p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"><BookOpen className="w-5 h-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{r.subject?.name || "Unknown subject"}</div>
                        <div className="text-xs text-gray-500 truncate">{r.teacher ? nameOf(r.teacher) : "Teacher left the institute"}</div>
                      </div>
                      <button onClick={() => removeSubjectTeacher(r.teacherId, r.subjectId, r.batchIds)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lab batches */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Batches (labs)</h3>
                <button onClick={() => { setNewBatchName(`${openSection.name} ${String.fromCharCode(65 + Math.max(0, (perSection[openSection.id]?.batches.length || 1) - 1))}`); setModal("batch"); }}
                  className="px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add batch</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(perSection[openSection.id]?.batches || []).map(b => (
                  <div key={b.id} className="hod-card p-3 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{b.name}</span>
                    <span className="ml-auto text-xs text-gray-500">{students.filter(s => s.batch_id === b.id).length}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Tip: split 60 students into A / B / C for labs. Moving students between batches comes in the next update.</p>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODALS ================= */}
      {modal === "section" && (
        <Modal title="New section" onClose={() => setModal(null)}>
          <label className="text-xs font-semibold text-gray-600 uppercase">Name</label>
          <input className="hod-field mt-1 mb-3" placeholder={`e.g. ${dept?.name}-1`} value={newSection.name} autoFocus
            onChange={e => setNewSection({ ...newSection, name: e.target.value })} onKeyDown={e => e.key === "Enter" && createSection()} />
          <label className="text-xs font-semibold text-gray-600 uppercase">Year (optional)</label>
          <input className="hod-field mt-1" type="number" min={1} max={6} placeholder="e.g. 2" value={newSection.year}
            onChange={e => setNewSection({ ...newSection, year: e.target.value })} />
          <button disabled={busy || !newSection.name.trim()} onClick={createSection} className="hod-btn w-full mt-5 py-2.5 rounded-xl text-sm font-semibold">
            {busy ? "Creating…" : "Create section"}
          </button>
        </Modal>
      )}

      {modal === "proctor" && openSection && deptId && (
        <Modal title={`Class teacher · ${openSection.name}`} onClose={() => setModal(null)}>
          <TeacherPicker members={members} deptId={deptId} busy={busy} onPick={assignProctor} />
        </Modal>
      )}

      {modal === "subject" && openSection && deptId && (
        <Modal title={`Assign subject · ${openSection.name}`} onClose={() => setModal(null)}>
          {!subjForm.teacher ? (
            <>
              <label className="text-xs font-semibold text-gray-600 uppercase">Subject</label>
              <select className="hod-field mt-1 mb-2" value={subjForm.subjectId}
                onChange={e => setSubjForm({ ...subjForm, subjectId: e.target.value, newName: "" })}>
                <option value="">— New subject —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
              </select>
              {!subjForm.subjectId && (
                <input className="hod-field mb-3" placeholder="New subject name, e.g. Data Structures" value={subjForm.newName}
                  onChange={e => setSubjForm({ ...subjForm, newName: e.target.value })} />
              )}
              <label className="text-xs font-semibold text-gray-600 uppercase block mt-2 mb-1">Teacher</label>
              {(subjForm.subjectId || subjForm.newName.trim())
                ? <TeacherPicker members={members} deptId={deptId} onPick={m => setSubjForm({ ...subjForm, teacher: m })} />
                : <p className="text-xs text-gray-500">Pick or type a subject first.</p>}
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm mb-4">
                <div><span className="text-gray-500">Subject:</span> <b>{subjects.find(s => s.id === subjForm.subjectId)?.name || subjForm.newName}</b></div>
                <div className="mt-1"><span className="text-gray-500">Teacher:</span> <b>{nameOf(subjForm.teacher)}</b></div>
                <div className="mt-1"><span className="text-gray-500">Section:</span> <b>{openSection.name}</b></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSubjForm({ ...subjForm, teacher: null })} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold">Back</button>
                <button disabled={busy} onClick={assignSubjectTeacher} className="hod-btn flex-1 py-2.5 rounded-xl text-sm font-semibold">{busy ? "Saving…" : "Assign"}</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {modal === "batch" && openSection && (
        <Modal title={`Add batch · ${openSection.name}`} onClose={() => setModal(null)}>
          <input className="hod-field" value={newBatchName} autoFocus onChange={e => setNewBatchName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createBatch()} />
          <button disabled={busy || !newBatchName.trim()} onClick={createBatch} className="hod-btn w-full mt-4 py-2.5 rounded-xl text-sm font-semibold">
            {busy ? "Adding…" : "Add batch"}
          </button>
        </Modal>
      )}
    </div>
  );
};

export default AdminDashboardPage;