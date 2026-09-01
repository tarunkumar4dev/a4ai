// src/pages/StudentProfilePage.tsx
// Route: /institute/students/:studentId

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

/* ─── Avatar ─────────────────────────────────────────────────────── */
function Avatar({ gender, size = 80 }: { gender?: string | null; size?: number }) {
  const isMale = gender !== "female";
  const bg = isMale ? "#FF7043" : "#EC4899";
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="40" fill={bg} fillOpacity="0.15" />
      <circle cx="40" cy="32" r="14" fill="#F5D0A9" />
      {isMale ? (
        <path d="M26 28c0-8 6-16 14-16s14 8 14 16" fill="#1E293B" />
      ) : (
        <>
          <path d="M24 30c0-10 7-18 16-18s16 8 16 18" fill="#1E293B" />
          <path d="M22 32c-1 6 0 14 2 18" stroke="#1E293B" strokeWidth="2.5" fill="none" />
          <path d="M58 32c1 6 0 14-2 18" stroke="#1E293B" strokeWidth="2.5" fill="none" />
        </>
      )}
      <ellipse cx="40" cy="62" rx="18" ry="14" fill={bg} fillOpacity="0.6" />
      <circle cx="34" cy="31" r="1.5" fill="#1E293B" />
      <circle cx="46" cy="31" r="1.5" fill="#1E293B" />
      <path d="M36 37 Q40 40 44 37" stroke="#1E293B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Attendance Bar ─────────────────────────────────────────────── */
function AttBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? "#22C55E" : pct >= 70 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <div style={{ flex: 1, height: 10, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 5, background: color }}
        />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 38, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

/* ─── Report Card ────────────────────────────────────────────────── */
function printReport(student: any, att: any, monthly: any[], instituteName: string, logoUrl?: string | null) {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const attColor = att.pct >= 85 ? "#22C55E" : att.pct >= 70 ? "#F59E0B" : "#EF4444";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report — ${student.name}</title>
<style>
  @page{size:A4;margin:20mm}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#1E293B;max-width:780px;margin:auto;padding:40px}
  .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FF7043;padding-bottom:14px;margin-bottom:22px}
  .inst{font-size:18px;font-weight:700;color:#C2410C}.sub{font-size:11px;color:#64748B}
  .badge{border:2px solid #FF7043;border-radius:8px;padding:6px 14px;color:#FF7043;font-weight:700;font-size:12px}
  .title{text-align:center;font-size:14px;font-weight:700;color:#FF7043;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px}
  .row{display:flex;gap:24px;margin-bottom:24px}
  .av{width:90px;height:90px;border-radius:12px;background:#FFF5F2;display:flex;align-items:center;justify-content:center;font-size:48px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;flex:1}
  .lbl{font-size:10px;color:#94A3B8;text-transform:uppercase}
  .val{font-size:14px;font-weight:600;margin-bottom:6px}
  .sec{font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin:20px 0 8px;border-bottom:1px solid #E2E8F0;padding-bottom:4px}
  .stats{display:flex;gap:28px;margin:10px 0}
  .stat{text-align:center}.sn{font-size:26px;font-weight:800}.sl{font-size:10px;color:#94A3B8;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#F8FAFC;padding:8px 12px;text-align:left;font-size:10px;color:#64748B;text-transform:uppercase;border-bottom:2px solid #E2E8F0}
  td{padding:8px 12px;font-size:13px;border-bottom:1px solid #F1F5F9}
  .footer{margin-top:40px;padding-top:14px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;font-size:11px;color:#94A3B8}
</style></head><body>
<div class="hdr">
  <div style="display:flex;align-items:center;gap:14px">
    ${logoUrl ? `<img src="${logoUrl}" alt="logo" style="width:60px;height:60px;border-radius:10px;object-fit:contain;border:1px solid #F1F5F9" />` : `<div style="width:60px;height:60px;border-radius:10px;background:#FFF5F2;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#FF7043;border:1px solid #FFE0D6">${instituteName.slice(0,2).toUpperCase()}</div>`}
    <div><div class="inst">${instituteName}</div><div class="sub">Powered by a4ai.in</div></div>
  </div>
  <div class="badge">a4ai</div>
</div>
<div class="title">Student Attendance Report</div>
<div class="row">
  <div class="av">${student.gender === "female" ? "👧" : "👦"}</div>
  <div class="g2">
    <div><div class="lbl">Name</div><div class="val">${student.name}</div></div>
    <div><div class="lbl">Roll No.</div><div class="val">${student.roll_no || "—"}</div></div>
    <div><div class="lbl">Batch</div><div class="val">${student.batchName || "—"}</div></div>
    <div><div class="lbl">Class</div><div class="val">${student.class_level || "—"}</div></div>
    ${student.parent_name ? `<div><div class="lbl">Parent</div><div class="val">${student.parent_name}</div></div>` : ""}
    ${student.parent_phone ? `<div><div class="lbl">Contact</div><div class="val">${student.parent_phone}</div></div>` : ""}
  </div>
</div>
<div class="sec">Attendance Summary</div>
<div class="stats">
  <div class="stat"><div class="sn" style="color:${attColor}">${att.pct}%</div><div class="sl">Overall</div></div>
  <div class="stat"><div class="sn" style="color:#3B82F6">${att.present}</div><div class="sl">Present</div></div>
  <div class="stat"><div class="sn" style="color:#EF4444">${att.absent}</div><div class="sl">Absent</div></div>
  <div class="stat"><div class="sn" style="color:#64748B">${att.total}</div><div class="sl">Total Days</div></div>
</div>
${monthly.length > 0 ? `
<table>
  <tr><th>Month</th><th>Present</th><th>Total</th><th>Attendance %</th></tr>
  ${monthly.map(m => `<tr><td>${m.month}</td><td>${m.present}</td><td>${m.total}</td><td>${m.pct}%</td></tr>`).join("")}
</table>` : ""}
<div class="footer">
  <div>Generated: ${today} · a4ai.in</div>
  <div>Signature: _____________________</div>
</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent]   = useState<any>(null);
  const [att, setAtt]           = useState({ total: 0, present: 0, absent: 0, pct: 0 });
  const [monthly, setMonthly]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [instituteName, setInstituteName] = useState("Institute");
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { if (studentId) load(); }, [studentId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // ── 1. Fetch student (simple — only columns we know exist) ──
      const { data: s, error: sErr } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (sErr || !s) {
        console.error("Student fetch error:", sErr);
        setError("Student not found. Make sure the route and RLS policies allow reading this student.");
        setLoading(false);
        return;
      }

      // ── 2. Fetch batch name separately ──
      let batchName = "Unassigned";
      let batchClassLevel = s.class_level;
      if (s.batch_id) {
        const { data: b } = await supabase
          .from("batches")
          .select("name, class_level")
          .eq("id", s.batch_id)
          .single();
        if (b) { batchName = b.name; batchClassLevel = batchClassLevel || b.class_level; }
      }

      // ── 3. Fetch department name separately ──
      let deptName = "";
      if (s.department_id) {
        const { data: d } = await supabase
          .from("departments")
          .select("name")
          .eq("id", s.department_id)
          .single();
        if (d) deptName = d.name;
      }

      // ── 4. Fetch institute name ──
      const { data: member } = await supabase
        .from("institute_members")
        .select("institute_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .eq("status", "active")
        .limit(1)
        .single();
      if (member?.institute_id) {
        const { data: inst } = await supabase
          .from("institutes")
          .select("name")
          .eq("id", member.institute_id)
          .single();
        if (inst) {
          setInstituteName(inst.name);
          // fetch logo
          try {
            const { data: logoData } = supabase.storage.from("institute-assets").getPublicUrl(`${member.institute_id}/logo`);
            const logoRes = await fetch(logoData.publicUrl, { method: "HEAD" });
            if (logoRes.ok && logoRes.headers.get("content-type")?.startsWith("image")) {
              setInstituteLogoUrl(logoData.publicUrl + `?t=${Date.now()}`);
            }
          } catch { /* no logo */ }
        }
      }

      setStudent({ ...s, batchName, class_level: batchClassLevel, deptName });

      // ── 5. Fetch attendance ──
      if (s.batch_id) {
        const { data: attRows } = await supabase
          .from("attendance")
          .select("date, records")
          .eq("batch_id", s.batch_id);

        if (attRows && attRows.length > 0) {
          let present = 0, total = 0;
          const monthMap: Record<string, { present: number; total: number }> = {};

          attRows.forEach((row: any) => {
            const records: Record<string, string> = typeof row.records === "object" ? row.records : {};
            const status = records[s.id];
            if (status === undefined) return;
            total++;
            const monthKey = new Date(row.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
            if (!monthMap[monthKey]) monthMap[monthKey] = { present: 0, total: 0 };
            monthMap[monthKey].total++;
            if (status === "present") { present++; monthMap[monthKey].present++; }
          });

          const pct = total > 0 ? Math.round((present / total) * 100) : 0;
          setAtt({ total, present, absent: total - present, pct });
          setMonthly(Object.entries(monthMap).map(([month, v]) => ({
            month,
            present: v.present,
            total: v.total,
            pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
          })));
        }
      }

    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(err?.message || "Something went wrong");
    }
    setLoading(false);
  }

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F9FC" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #F0F2F5", borderTopColor: "#FF7043", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#94A3B8", fontWeight: 600, fontSize: 14 }}>Loading student profile...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  // ── Error ──
  if (error || !student) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#F7F9FC", padding: 24 }}>
      <div style={{ background: "#FEE2E2", borderRadius: 12, padding: "12px 20px", fontSize: 14, color: "#DC2626", fontWeight: 600, maxWidth: 400, textAlign: "center" }}>
        ⚠️ {error || "Student not found"}
      </div>
      <button onClick={() => navigate(-1)} style={{ background: "#FF7043", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>← Go Back</button>
    </div>
  );

  const attColor = att.pct >= 85 ? "#22C55E" : att.pct >= 70 ? "#F59E0B" : "#EF4444";
  const attBadge = att.pct >= 85
    ? { bg: "#DCFCE7", color: "#16A34A", label: "Good Standing" }
    : att.pct >= 70
    ? { bg: "#FEF3C7", color: "#D97706", label: "Needs Attention" }
    : att.total === 0
    ? { bg: "#F1F5F9", color: "#64748B", label: "No Records Yet" }
    : { bg: "#FEE2E2", color: "#DC2626", label: "Critical" };

  const gradBg = student.gender === "female"
    ? "linear-gradient(135deg, #EC4899, #BE185D)"
    : "linear-gradient(135deg, #FF7043, #E85A28)";

  const details = [
    { label: "Roll No.", value: student.roll_no || "—" },
    { label: "Class", value: student.class_level || "—" },
    { label: "Batch", value: student.batchName },
    student.deptName ? { label: "Department", value: student.deptName } : null,
    student.parent_name ? { label: "Parent Name", value: student.parent_name } : null,
    student.parent_phone ? { label: "Parent Phone", value: student.parent_phone } : null,
    student.phone ? { label: "Student Phone", value: student.phone } : null,
    student.email ? { label: "Email", value: student.email } : null,
    student.address ? { label: "Address", value: student.address } : null,
  ].filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F9FC", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", paddingBottom: 48 }}>

      {/* ── Sticky Top Bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F1F5F9", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
        <button onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, color: "#475569", cursor: "pointer" }}>
          ← Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{student.name}</span>
        <button onClick={() => printReport(student, att, monthly, instituteName, instituteLogoUrl)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#FF7043", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          📄 Report Card
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "24px auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Profile Card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>

          {/* header */}
          <div style={{ background: gradBg, padding: "24px 24px 44px", display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 76, height: 76, borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.2)", border: "3px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Avatar gender={student.gender} size={76} />
            </div>
            <div style={{ color: "#fff", minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{student.name}</h1>
              <p style={{ opacity: 0.85, fontSize: 13, margin: "4px 0 0" }}>{student.batchName} · Roll {student.roll_no || "—"}</p>
              {student.deptName && <p style={{ opacity: 0.7, fontSize: 12, margin: "2px 0 0" }}>{student.deptName}</p>}
            </div>
          </div>

          {/* stat chips */}
          <div style={{ display: "flex", gap: 10, padding: "0 20px", marginTop: -24, flexWrap: "wrap" }}>
            {[
              { label: "Attendance", value: `${att.pct}%`, color: attColor },
              { label: "Present",    value: att.present,   color: "#FF7043" },
              { label: "Absent",     value: att.absent,    color: "#EF4444" },
              { label: "Total Days", value: att.total,     color: "#64748B" },
            ].map((chip, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{ background: "#fff", borderRadius: 12, padding: "8px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", textAlign: "center", minWidth: 64 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: chip.color, lineHeight: 1 }}>{chip.value}</div>
                <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>{chip.label}</div>
              </motion.div>
            ))}
          </div>

          {/* student details */}
          <div style={{ padding: "18px 22px 22px", borderTop: "1px solid #F1F5F9", marginTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Student Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
              {details.map((d: any, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", wordBreak: "break-word" }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Attendance Card ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: "#fff", borderRadius: 20, padding: "20px 22px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Monthly Attendance</p>
            <span style={{ background: attBadge.bg, color: attBadge.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{attBadge.label}</span>
          </div>

          {monthly.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8", fontSize: 13 }}>
              {att.total === 0
                ? "No attendance records yet — mark attendance from the Attendance tab."
                : `${att.present} present / ${att.total} total days`}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {monthly.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", minWidth: 72 }}>{m.month}</span>
                  <div style={{ flex: 1 }}><AttBar pct={m.pct} /></div>
                  <span style={{ fontSize: 11, color: "#94A3B8", minWidth: 52, textAlign: "right" }}>{m.present}/{m.total}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}