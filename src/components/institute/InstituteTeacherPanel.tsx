// src/components/institute/InstituteTeacherPanel.tsx
// Shows teacher's institute info — name, role, department, batches, student count
// Fixes: #1 prominent card, #2 teacher name, #3 department display, #7 join prompt

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

type InstituteInfo = {
  id: string;
  name: string;
  logo_url?: string | null;
};

type MemberInfo = {
  role: string;
  status: string;
  department_name?: string;
  department_id?: string | null;
};

type BatchInfo = {
  id: string;
  name: string;
  class_level?: string;
  student_count?: number;
};

export default function InstituteTeacherPanel({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(true);
  const [institute, setInstitute]   = useState<InstituteInfo | null>(null);
  const [member, setMember]         = useState<MemberInfo | null>(null);
  const [batches, setBatches]       = useState<BatchInfo[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [logoUrl, setLogoUrl]       = useState<string | null>(null);

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      // 1. Get institute membership
      const { data: mem } = await supabase
        .from("institute_members")
        .select("institute_id, role, status, department_id, user_name, user_email")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!mem) { setLoading(false); return; }

      // 2. Get institute details
      const { data: inst } = await supabase
        .from("institutes")
        .select("id, name")
        .eq("id", mem.institute_id)
        .single();

      if (!inst) { setLoading(false); return; }
      setInstitute(inst);

      // 3. Get department name if assigned
      let deptName = "";
      if (mem.department_id) {
        const { data: dept } = await supabase
          .from("departments")
          .select("name")
          .eq("id", mem.department_id)
          .single();
        if (dept) deptName = dept.name;
      }

      setMember({
        role: mem.role,
        status: mem.status,
        department_name: deptName || undefined,
        department_id: mem.department_id,
      });

      // 4. Get assigned batches from teacher_batches table
      const { data: tb } = await supabase
        .from("teacher_batches").select("batch_id")
        .eq("teacher_id", userId).eq("institute_id", mem.institute_id);

      let batchRows: any[] = [];
      if (tb && tb.length > 0) {
        const { data: bRows } = await supabase
          .from("batches").select("id, name, class_level")
          .in("id", tb.map(t => t.batch_id)).eq("is_active", true).order("name");
        batchRows = bRows || [];
      } else if (mem.department_id) {
        // Fallback: department batches
        const { data: bRows } = await supabase
          .from("batches").select("id, name, class_level")
          .eq("institute_id", mem.institute_id).eq("department_id", mem.department_id)
          .eq("is_active", true).order("name");
        batchRows = bRows || [];
      }

      if (batchRows && batchRows.length > 0) {
        // Get student counts per batch
        const { data: stuCounts } = await supabase
          .from("students")
          .select("batch_id")
          .eq("institute_id", mem.institute_id)
          .eq("is_active", true)
          .in("batch_id", batchRows.map(b => b.id));

        const countMap: Record<string, number> = {};
        stuCounts?.forEach(s => {
          if (s.batch_id) countMap[s.batch_id] = (countMap[s.batch_id] || 0) + 1;
        });

        const enriched = batchRows.map(b => ({
          ...b,
          student_count: countMap[b.id] || 0,
        }));
        setBatches(enriched);
        setTotalStudents(Object.values(countMap).reduce((a, b) => a + b, 0));
      }

      // 5. Try logo
      try {
        const { data: logoData } = supabase.storage
          .from("institute-assets")
          .getPublicUrl(`${inst.id}/logo`);
        const res = await fetch(logoData.publicUrl, { method: "HEAD" });
        if (res.ok && res.headers.get("content-type")?.startsWith("image")) {
          setLogoUrl(logoData.publicUrl + `?t=${Date.now()}`);
        }
      } catch { /* no logo */ }

    } catch (e) { console.error("InstituteTeacherPanel:", e); }
    setLoading(false);
  }

  // ── Not in any institute ──────────────────────────────────────
  if (!loading && !institute) {
    return (
      <div style={{
        background: "#fff",
        border: "1.5px dashed #E2E8F0",
        borderRadius: 20,
        padding: "24px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FFF5F2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏛️</div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Not part of any institute</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94A3B8" }}>Join an institute to manage classes and students</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/join-institute")}
          style={{ background: "#FF7043", color: "#fff", border: "none", borderRadius: 12, padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Join Institute →
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ height: 80, background: "#F8FAFC", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (!institute || !member) return null;

  const roleLabel = member.role === "hod" ? "HOD" : member.role === "admin" ? "Administrator" : "Teacher";
  const roleColor = member.role === "hod" ? "#8B5CF6" : member.role === "admin" ? "#FF7043" : "#3B82F6";

  // ── Main Card ─────────────────────────────────────────────────
  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
      overflow: "hidden",
    }}>
      {/* Header stripe */}
      <div style={{
        background: "linear-gradient(135deg, #FF7043, #F4511E)",
        padding: "18px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}>
        {/* Logo or initials */}
        <div style={{
          width: 52, height: 52, borderRadius: 14, overflow: "hidden",
          background: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0,
        }}>
          {logoUrl
            ? <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
                {institute.name.slice(0, 2).toUpperCase()}
              </span>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {institute.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
              {roleLabel}
            </span>
            {member.department_name && (
              <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20 }}>
                Dept: {member.department_name}
              </span>
            )}
            {!member.department_name && (
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>No department assigned yet</span>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{totalStudents}</p>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 700, textTransform: "uppercase" }}>Students</p>
        </div>
      </div>

      {/* Batches list */}
      <div style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>
            My Batches ({batches.length})
          </p>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>
            {batches.length} batch{batches.length !== 1 ? "es" : ""}
          </span>
        </div>

        {batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#94A3B8", fontSize: 13 }}>
            <p style={{ margin: 0 }}>No batches assigned yet</p>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>Your admin will assign you to batches</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {batches.map(b => (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "#F8FAFC", borderRadius: 12,
                border: "1px solid #F1F5F9",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FFF5F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF7043", fontSize: 14 }}>📚</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{b.name}</p>
                    {b.class_level && <p style={{ margin: 0, fontSize: 11, color: "#94A3B8" }}>Class {b.class_level}</p>}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", background: "#E2E8F0", padding: "3px 10px", borderRadius: 20 }}>
                  {b.student_count} student{b.student_count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}