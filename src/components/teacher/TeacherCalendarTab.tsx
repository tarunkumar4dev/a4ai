// src/components/teacher/TeacherCalendarTab.tsx
// Microsoft Outlook-style calendar for teachers
// Fully responsive — no overflow, proper date boxes

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────── */
type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  meeting_link?: string;
  color: string;
  batch_id?: string;
  batch_name?: string;
  is_assignment?: boolean;
};

type Batch = { id: string; name: string };

/* ─── Constants ─────────────────────────── */
const EVENT_TYPES = [
  { id: "event",    label: "Event",    color: "#6366F1", icon: "📅" },
  { id: "meeting",  label: "Meeting",  color: "#3B82F6", icon: "📹" },
  { id: "deadline", label: "Deadline", color: "#F59E0B", icon: "⏰" },
  { id: "holiday",  label: "Holiday",  color: "#22C55E", icon: "🎉" },
  { id: "exam",     label: "Exam",     color: "#EF4444", icon: "📝" },
  { id: "class",    label: "Class",    color: "#8B5CF6", icon: "🏫" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ─── Helpers ───────────────────────────── */
function sameDay(a: Date, b: Date) { 
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); 
}
function fmtTime(d: string) { 
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); 
}
function fmtDate(d: Date) { 
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); 
}
function isToday(d: Date) {
  const t = new Date();
  return sameDay(d, t);
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function TeacherCalendarTab() {
  const { user } = useAuth();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month"|"week">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [instituteId, setInstituteId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", event_type: "event", start_time: "",
    end_time: "", all_day: false, meeting_link: "", batch_id: "", color: "#6366F1"
  });
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => { loadData(); }, []);

  // Realtime
  useEffect(() => {
    if (!instituteId) return;
    const ch = supabase
      .channel(`teacher-calendar-${instituteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instituteId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: member } = await supabase
        .from("institute_members").select("institute_id")
        .eq("user_id", user?.id).eq("status", "active").limit(1).single();
      if (!member) { setLoading(false); return; }
      setInstituteId(member.institute_id);

      const { data: bRows } = await supabase
        .from("batches").select("id, name")
        .eq("institute_id", member.institute_id).eq("is_active", true).order("name");
      if (bRows) setBatches(bRows);
      const batchMap: Record<string, string> = {};
      bRows?.forEach(b => batchMap[b.id] = b.name);

      const { data: evts } = await supabase
        .from("calendar_events").select("*")
        .eq("institute_id", member.institute_id)
        .order("start_time");

      const { data: asgns } = await supabase
        .from("assignments").select("id, title, batch_id, deadline, max_marks")
        .eq("institute_id", member.institute_id)
        .eq("status", "active")
        .not("deadline", "is", null);

      const calEvents: CalendarEvent[] = [];
      if (evts) evts.forEach(e => calEvents.push({
        ...e, batch_name: e.batch_id ? batchMap[e.batch_id] || "" : "All",
      }));
      if (asgns) asgns.forEach(a => {
        if (a.deadline) calEvents.push({
          id: `asgn-${a.id}`,
          title: `📋 ${a.title}`,
          description: `Assignment deadline${a.max_marks ? ` · ${a.max_marks} marks` : ""}`,
          event_type: "deadline",
          start_time: a.deadline,
          all_day: false,
          color: "#F59E0B",
          batch_id: a.batch_id,
          batch_name: batchMap[a.batch_id] || "",
          is_assignment: true,
        });
      });

      calEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      setEvents(calEvents);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  /* ── Create Event ── */
  function openCreate(date?: Date) {
    const d = date || new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({
      title: "", description: "", event_type: "event", start_time: iso,
      end_time: "", all_day: false, meeting_link: "", batch_id: "", color: "#6366F1"
    });
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.start_time || !instituteId || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("calendar_events").insert({
        institute_id: instituteId,
        batch_id: form.batch_id || null,
        created_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        start_time: form.start_time,
        end_time: form.end_time || null,
        all_day: form.all_day,
        meeting_link: form.meeting_link.trim() || null,
        color: form.color,
      });
      if (error) throw error;
      toast.success("Event created!");
      setShowCreate(false);
      loadData();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setSaving(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    setSelectedEvent(null);
    loadData();
  }

  /* ── Navigation ── */
  function prevMonth() { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)); }
  function prevWeek() { setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000)); }
  function nextWeek() { setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000)); }
  function goToday() { setCurrentDate(new Date()); }

  /* ── Month Grid Data ── */
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false });
    for (let i = 1; i <= daysInMonth; i++) cells.push({ date: new Date(year, month, i), isCurrentMonth: true });
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    return cells;
  }, [currentDate]);

  /* ── Week Grid Data ── */
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  function getEventsForDay(date: Date) {
    return events.filter(e => sameDay(new Date(e.start_time), date));
  }

  const upcoming = events
    .filter(e => new Date(e.start_time) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 8);

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "'Segoe UI', 'Plus Jakarta Sans', system-ui, sans-serif", maxWidth: "100%", overflow: "hidden" }}>
      {/* ── Create Modal ── */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, padding: 28, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "slideIn 0.2s ease-out" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#1E293B" }}>📅 New Event</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} placeholder="Event title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
              
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.id}
                    onClick={() => setForm({ ...form, event_type: t.id, color: t.color })}
                    style={{ border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: form.event_type === t.id ? t.color : "#F1F5F9", color: form.event_type === t.id ? "#fff" : "#64748B" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <select style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">All batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>START</label>
                  <input style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>END</label>
                  <input style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} style={{ accentColor: "#6366F1" }} />
                <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>All day event</span>
              </div>

              {form.event_type === "meeting" && (
                <input style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} placeholder="Meeting link (Google Meet / Zoom)" value={form.meeting_link} onChange={e => setForm({ ...form, meeting_link: e.target.value })} />
              )}

              <textarea style={{ width: "100%", padding: "10px 14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical" }} rows={2} placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                <button style={{ border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", background: "#F1F5F9", color: "#475569" }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button style={{ border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "#fff", opacity: saving || !form.title.trim() ? 0.5 : 1 }} onClick={handleCreate} disabled={saving || !form.title.trim()}>
                  {saving ? "Creating..." : "✓ Create Event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSelectedEvent(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "slideIn 0.2s ease-out" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: selectedEvent.color }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1E293B", flex: 1 }}>{selectedEvent.title}</h3>
              <button style={{ border: "none", background: "#F1F5F9", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 14 }} onClick={() => setSelectedEvent(null)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "#475569" }}>
              <p style={{ margin: 0 }}>📅 {new Date(selectedEvent.start_time).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              {!selectedEvent.all_day && <p style={{ margin: 0 }}>🕐 {fmtTime(selectedEvent.start_time)}{selectedEvent.end_time ? ` — ${fmtTime(selectedEvent.end_time)}` : ""}</p>}
              {selectedEvent.batch_name && <p style={{ margin: 0 }}>📚 {selectedEvent.batch_name}</p>}
              {selectedEvent.meeting_link && (
                <a href={selectedEvent.meeting_link} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EEF2FF", color: "#4F46E5", padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  📹 Join Meeting
                </a>
              )}
              {selectedEvent.description && <p style={{ margin: 0, color: "#64748B", lineHeight: 1.6 }}>{selectedEvent.description}</p>}
            </div>
            {!selectedEvent.is_assignment && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
                <button style={{ border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", background: "#FEE2E2", color: "#DC2626" }} onClick={() => deleteEvent(selectedEvent.id)}>🗑️ Delete</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#1E293B" }}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ border: "none", background: "#F1F5F9", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, fontSize: 16 }} onClick={viewMode === "month" ? prevMonth : prevWeek}>‹</button>
            <button style={{ border: "none", background: "#F1F5F9", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }} onClick={goToday}>Today</button>
            <button style={{ border: "none", background: "#F1F5F9", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700, fontSize: 16 }} onClick={viewMode === "month" ? nextMonth : nextWeek}>›</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 2, background: "#F1F5F9", borderRadius: 10, padding: 2 }}>
            <button style={{ border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: viewMode === "month" ? "#fff" : "transparent", color: viewMode === "month" ? "#1E293B" : "#94A3B8", boxShadow: viewMode === "month" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }} onClick={() => setViewMode("month")}>Month</button>
            <button style={{ border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: viewMode === "week" ? "#fff" : "transparent", color: viewMode === "week" ? "#1E293B" : "#94A3B8", boxShadow: viewMode === "week" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }} onClick={() => setViewMode("week")}>Week</button>
          </div>
          <button style={{ border: "none", borderRadius: 10, padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", background: "linear-gradient(135deg, #6366F1, #4F46E5)", color: "#fff" }} onClick={() => openCreate()}>+ Add Event</button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, maxWidth: "100%" }}>
        {/* ── Calendar Grid ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden", maxWidth: "100%" }}>
          {viewMode === "month" ? (
            <>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>{d}</div>
                ))}
              </div>
              {/* Date grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                {monthGrid.map((cell, i) => {
                  const dayEvents = getEventsForDay(cell.date);
                  const isTodayDate = isToday(cell.date);
                  const isCurrent = cell.isCurrentMonth;
                  return (
                    <div key={i}
                      style={{
                        minHeight: 90,
                        padding: "4px 6px",
                        background: isTodayDate ? "#EEF2FF" : isCurrent ? "#fff" : "#F8FAFC",
                        borderRadius: 8,
                        border: isTodayDate ? "2px solid #6366F1" : "1px solid #F1F5F9",
                        cursor: "pointer",
                        transition: "background 0.1s",
                        overflow: "hidden",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                      }}
                      onClick={() => openCreate(cell.date)}
                    >
                      <div style={{
                        fontSize: 14,
                        fontWeight: isTodayDate ? 800 : 500,
                        color: isTodayDate ? "#6366F1" : isCurrent ? "#1E293B" : "#CBD5E1",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: isTodayDate ? "#6366F1" : "transparent",
                        color: isTodayDate ? "#fff" : isCurrent ? "#1E293B" : "#CBD5E1",
                        marginBottom: 4,
                      }}>
                        {cell.date.getDate()}
                      </div>
                      {dayEvents.slice(0, 3).map(e => (
                        <div key={e.id}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            marginBottom: 2,
                            background: e.color + "20",
                            color: e.color,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            cursor: "pointer",
                            maxWidth: "100%",
                          }}
                          onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); }}
                        >
                          {e.title.length > 12 ? e.title.slice(0, 12) + "…" : e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, padding: "0 4px" }}>+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Week View ── */
            <div style={{ overflow: "auto", maxWidth: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 0, minWidth: 600 }}>
                <div />
                {weekDays.map((d, i) => (
                  <div key={i} style={{ padding: "8px 4px", textAlign: "center", fontSize: 12, fontWeight: 700, color: isToday(d) ? "#6366F1" : "#94A3B8", borderBottom: isToday(d) ? "2px solid #6366F1" : "2px solid #F1F5F9" }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase" }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: isToday(d) ? "#6366F1" : "#1E293B" }}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              {hours.map(h => (
                <div key={h} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 0, minWidth: 600 }}>
                  <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "right", paddingRight: 8, height: 48, display: "flex", alignItems: "flex-start", paddingTop: 4 }}>
                    {h > 12 ? h-12 : h}{h >= 12 ? "PM" : "AM"}
                  </div>
                  {weekDays.map((d, di) => {
                    const dayEvts = getEventsForDay(d).filter(e => {
                      const eHour = new Date(e.start_time).getHours();
                      return eHour === h;
                    });
                    return (
                      <div key={di} style={{ borderLeft: "1px solid #F8FAFC", borderBottom: "1px solid #F8FAFC", minHeight: 48, padding: 2, cursor: "pointer" }}
                        onClick={() => {
                          const clickDate = new Date(d);
                          clickDate.setHours(h, 0, 0, 0);
                          openCreate(clickDate);
                        }}>
                        {dayEvts.map(e => (
                          <div key={e.id} style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 6px",
                            borderRadius: 6,
                            marginBottom: 2,
                            background: e.color + "20",
                            color: e.color,
                            borderLeft: `3px solid ${e.color}`,
                            cursor: "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                            onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); }}>
                            {fmtTime(e.start_time)} {e.title.length > 14 ? e.title.slice(0, 14) + "…" : e.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ maxWidth: "100%" }}>
          {/* Mini calendar */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{MONTHS[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}</span>
              <div style={{ display: "flex", gap: 2 }}>
                <button style={{ border: "none", background: "#F1F5F9", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }} onClick={prevMonth}>‹</button>
                <button style={{ border: "none", background: "#F1F5F9", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }} onClick={nextMonth}>›</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, textAlign: "center" }}>
              {DAYS.map(d => <div key={d} style={{ fontSize: 9, fontWeight: 700, color: "#CBD5E1", padding: "2px 0" }}>{d[0]}</div>)}
              {monthGrid.slice(0, 35).map((cell, i) => {
                const isTodayDate = isToday(cell.date);
                const hasEvents = getEventsForDay(cell.date).length > 0;
                return (
                  <div key={i}
                    style={{
                      fontSize: 11,
                      fontWeight: isTodayDate ? 800 : 500,
                      color: !cell.isCurrentMonth ? "#CBD5E1" : isTodayDate ? "#fff" : "#475569",
                      background: isTodayDate ? "#6366F1" : "transparent",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onClick={() => setCurrentDate(cell.date)}>
                    {cell.date.getDate()}
                    {hasEvents && !isTodayDate && <div style={{ position: "absolute", bottom: 0, width: 4, height: 4, borderRadius: "50%", background: "#6366F1" }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming events */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Upcoming Events</h4>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>No upcoming events</p>
            ) : (
              upcoming.map(e => (
                <div key={e.id}
                  style={{ padding: "10px 14px", borderRadius: 12, borderLeft: `4px solid ${e.color}`, marginBottom: 8, background: "#FAFAFA", cursor: "pointer", transition: "all 0.15s" }}
                  onClick={() => setSelectedEvent(e)}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{e.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>
                    {fmtDate(new Date(e.start_time))} {!e.all_day && `· ${fmtTime(e.start_time)}`}
                    {e.batch_name && ` · ${e.batch_name}`}
                  </p>
                  {e.meeting_link && <span style={{ fontSize: 11, color: "#4F46E5", fontWeight: 700 }}>📹 Meeting</span>}
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginTop: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Categories</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {EVENT_TYPES.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color }} />
                  {t.icon} {t.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyframe animation ── */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tc-root * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .tc-main-grid { grid-template-columns: 1fr !important; }
          .tc-day-cell { min-height: 60px !important; }
        }
      `}</style>
    </div>
  );
}