// src/components/institute/AssignTeacherModal.tsx
// Modal for admin to assign a teacher to a batch

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

interface Teacher {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  status: string;
}

interface Props {
  batchId: string;
  batchName: string;
  teachers: Teacher[];
  onClose: () => void;
  onAssigned: () => void;
}

const modalStyles = `
  .atm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .atm-card { background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); max-width: 420px; width: 100%; padding: 24px; animation: scaleIn 0.25s ease-out; }
  .dark .atm-card { background: rgb(24,24,27); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
  .atm-teacher-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.12s; border: 1px solid transparent; }
  .atm-teacher-row:hover { background: rgba(0,0,0,0.03); }
  .atm-teacher-row.selected { background: #eff6ff; border-color: #bfdbfe; }
  .dark .atm-teacher-row:hover { background: rgba(255,255,255,0.04); }
  .dark .atm-teacher-row.selected { background: rgba(37,99,235,0.12); border-color: rgba(96,165,250,0.2); }
`;

export default function AssignTeacherModal({ batchId, batchName, teachers, onClose, onAssigned }: Props) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!selectedTeacherId) return;
    setAssigning(true);
    try {
      const { error } = await supabase.from("batch_teachers").insert({
        batch_id: batchId,
        teacher_id: selectedTeacherId,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Teacher already assigned to this batch");
        } else {
          throw error;
        }
      } else {
        toast.success("Teacher assigned!");
        onAssigned();
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to assign");
    }
    setAssigning(false);
  };

  const activeTeachers = teachers.filter((t) => t.status === "active");

  return (
    <>
      <style>{modalStyles}</style>
      <div className="atm-overlay" onClick={onClose}>
        <div className="atm-card" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Assign Teacher</h3>
              <p style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>to {batchName}</p>
            </div>
            <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#a1a1aa" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {activeTeachers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ fontSize: 13, color: "#a1a1aa" }}>No teachers in your institute yet.</p>
              <p style={{ fontSize: 11, color: "#d4d4d8", marginTop: 4 }}>Invite teachers first using the join code.</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#71717a", marginBottom: 8 }}>Select a teacher:</p>
                <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeTeachers.map((t) => (
                    <div
                      key={t.user_id}
                      className={`atm-teacher-row ${selectedTeacherId === t.user_id ? "selected" : ""}`}
                      onClick={() => setSelectedTeacherId(t.user_id)}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", background: selectedTeacherId === t.user_id ? "#2563eb" : "#f4f4f5",
                        color: selectedTeacherId === t.user_id ? "white" : "#71717a",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 600, flexShrink: 0, transition: "all 0.15s",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.user_name || t.user_email || `Teacher ${t.user_id.slice(0, 8)}`}
                        </p>
                      </div>
                      {selectedTeacherId === t.user_id && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{
                  background: "transparent", color: "#71717a", fontWeight: 500, fontSize: 13,
                  padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", cursor: "pointer",
                }}>Cancel</button>
                <button onClick={handleAssign} disabled={!selectedTeacherId || assigning} style={{
                  background: "#111", color: "white", fontWeight: 600, fontSize: 13,
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  opacity: !selectedTeacherId || assigning ? 0.4 : 1,
                }}>{assigning ? "Assigning..." : "Assign Teacher"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}