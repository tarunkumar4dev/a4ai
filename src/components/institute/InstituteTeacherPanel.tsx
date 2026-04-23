// src/components/institute/InstituteTeacherPanel.tsx
// Drop this into TeacherDashboardPage to show institute context
// Shows: institute badge, assigned batches, batch students

import React, { useState } from "react";
import { useInstituteTeacher } from "@/hooks/useInstituteTeacher";
import { useNavigate } from "react-router-dom";

const panelStyles = `
  .inst-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
  .dark .inst-badge { background: rgba(37,99,235,0.12); color: #60a5fa; border-color: rgba(96,165,250,0.2); }
  .inst-card { background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; }
  .dark .inst-card { background: rgb(24,24,27); border-color: rgba(255,255,255,0.08); }
  .inst-row { padding: 10px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; transition: background 0.12s; }
  .inst-row:hover { background: rgba(0,0,0,0.02); }
  .dark .inst-row:hover { background: rgba(255,255,255,0.03); }
  .inst-tab { padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: none; background: transparent; color: #71717a; }
  .inst-tab:hover { background: rgba(0,0,0,0.04); }
  .inst-tab.active { background: rgba(0,0,0,0.06); color: #18181b; font-weight: 600; }
  .dark .inst-tab:hover { background: rgba(255,255,255,0.06); }
  .dark .inst-tab.active { background: rgba(255,255,255,0.08); color: white; }
  .inst-badge-sm { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: #f4f4f5; color: #52525b; }
  .dark .inst-badge-sm { background: rgba(255,255,255,0.08); color: #a1a1aa; }
  .inst-empty { padding: 40px 20px; text-align: center; }
  .inst-empty p { font-size: 13px; color: #a1a1aa; }
`;

interface Props {
  userId: string | undefined;
}

export default function InstituteTeacherPanel({ userId }: Props) {
  const navigate = useNavigate();
  const { membership, batches, students, loading } = useInstituteTeacher(userId);
  const [activeView, setActiveView] = useState<"batches" | "students">("batches");
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  // Not in any institute
  if (!loading && !membership) {
    return (
      <>
        <style>{panelStyles}</style>
        <div className="inst-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Institute</h3>
              <p style={{ fontSize: 13, color: "#71717a" }}>Join an institute to manage classes and students.</p>
            </div>
            <button
              onClick={() => navigate("/join-institute")}
              style={{
                background: "#111", color: "white", fontWeight: 600, fontSize: 13,
                padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              Join Institute
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <style>{panelStyles}</style>
        <div className="inst-card p-5">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 16, height: 16, border: "2px solid #d4d4d8", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <span style={{ fontSize: 13, color: "#71717a" }}>Loading institute data...</span>
          </div>
        </div>
      </>
    );
  }

  const filteredStudents = selectedBatch
    ? students.filter((s) => s.batch_id === selectedBatch)
    : students;

  return (
    <>
      <style>{panelStyles}</style>
      <div className="space-y-4">
        {/* Institute header badge */}
        <div className="inst-card p-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {membership!.institute_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{membership!.institute_name}</p>
              <p style={{ fontSize: 11, color: "#a1a1aa" }}>
                {batches.length} batch{batches.length !== 1 ? "es" : ""} assigned · {students.length} student{students.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <span className="inst-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/></svg>
            Teacher
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "2px", background: "rgba(0,0,0,0.03)", borderRadius: 10 }}>
          <button className={`inst-tab ${activeView === "batches" ? "active" : ""}`} onClick={() => setActiveView("batches")}>
            My Batches ({batches.length})
          </button>
          <button className={`inst-tab ${activeView === "students" ? "active" : ""}`} onClick={() => { setActiveView("students"); setSelectedBatch(null); }}>
            Students ({students.length})
          </button>
        </div>

        {/* Batches view */}
        {activeView === "batches" && (
          <div className="inst-card" style={{ overflow: "hidden" }}>
            {batches.length === 0 ? (
              <div className="inst-empty">
                <p>No batches assigned yet.</p>
                <p style={{ fontSize: 11, color: "#d4d4d8", marginTop: 4 }}>Your admin will assign you to batches.</p>
              </div>
            ) : (
              <div style={{ padding: 4 }}>
                {batches.map((b) => {
                  const batchStudentCount = students.filter((s) => s.batch_id === b.id).length;
                  return (
                    <div
                      key={b.id}
                      className="inst-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => { setSelectedBatch(b.id); setActiveView("students"); }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</p>
                        <p style={{ fontSize: 11, color: "#a1a1aa" }}>
                          {b.class_level ? `Class ${b.class_level}` : ""}{b.subject ? ` · ${b.subject}` : ""}
                        </p>
                      </div>
                      <span className="inst-badge-sm">{batchStudentCount} students</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Students view */}
        {activeView === "students" && (
          <div className="inst-card" style={{ overflow: "hidden" }}>
            {/* Batch filter chips */}
            {batches.length > 1 && (
              <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  className={`inst-tab ${!selectedBatch ? "active" : ""}`}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setSelectedBatch(null)}
                >
                  All ({students.length})
                </button>
                {batches.map((b) => (
                  <button
                    key={b.id}
                    className={`inst-tab ${selectedBatch === b.id ? "active" : ""}`}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setSelectedBatch(b.id)}
                  >
                    {b.name} ({students.filter((s) => s.batch_id === b.id).length})
                  </button>
                ))}
              </div>
            )}

            {filteredStudents.length === 0 ? (
              <div className="inst-empty">
                <p>No students in {selectedBatch ? "this batch" : "your batches"} yet.</p>
              </div>
            ) : (
              <div style={{ padding: 4 }}>
                {filteredStudents.map((s) => (
                  <div key={s.id} className="inst-row">
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", background: "#f4f4f5",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 600, color: "#52525b", flexShrink: 0,
                    }}>
                      {s.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name}
                      </p>
                      <p style={{ fontSize: 11, color: "#a1a1aa" }}>
                        Roll {s.roll_no || "—"}{s.parent_phone ? ` · ${s.parent_phone}` : ""}
                      </p>
                    </div>
                    <span className="inst-badge-sm">{s.batch_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}