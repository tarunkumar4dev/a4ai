// src/components/teacher/TeacherCalendarTab.tsx
// MS Office-style calendar for teachers — create events, auto-sync assignment deadlines
// Usage in TeacherDashboardPage:
//   import TeacherCalendarTab from "@/components/teacher/TeacherCalendarTab";
//   navItems: { id: "calendar", Icon: Icons.Calendar, label: "Calendar" }
//   {activeTab === "calendar" && <TeacherCalendarTab />}

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
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
function fmtDate(d: Date) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }

/* ─── Styles ────────────────────────────── */
const css = `
  .tc-root { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  .tc-card { background: #fff; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .tc-btn { border: none; border-radius: 10px; padding: 8px 16px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; }
  .tc-primary { background: linear-gradient(135deg, #6366F1, #4F46E5); color: #fff; }
  .tc-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
  .tc-primary:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .tc-ghost { background: #F1F5F9; color: #475569; }
  .tc-ghost:hover { background: #E2E8F0; }
  .tc-field { width: 100%; padding: 10px 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; }
  .tc-field:focus { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

  .tc-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .tc-day-cell { min-height: 90px; padding: 6px; border: 1px solid #F1F5F9; border-radius: 8px; cursor: pointer; transition: background .1s; position: relative; overflow: hidden; }
  .tc-day-cell:hover { background: #F8FAFC; }
  .tc-day-cell.today { background: #EEF2FF; border-color: #C7D2FE; }
  .tc-day-cell.other-month { opacity: .3; }
  .tc-day-num { font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 4px; }
  .tc-day-num.today { background: #6366F1; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .tc-event-dot { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }

  .tc-week-grid { display: grid; grid-template-columns: 60px repeat(7, 1fr); gap: 0; }
  .tc-week-header { padding: 8px 4px; text-align: center; font-size: 12px; font-weight: 700; color: #94A3B8; border-bottom: 2px solid #F1F5F9; }
  .tc-week-header.today { color: #6366F1; border-bottom-color: #6366F1; }
  .tc-time-label { font-size: 10px; color: #94A3B8; text-align: right; padding-right: 8px; height: 48px; display: flex; align-items: flex-start; }
  .tc-week-cell { border-left: 1px solid #F8FAFC; border-bottom: 1px solid #F8FAFC; min-height: 48px; padding: 2px; position: relative; }
  .tc-week-event { font-size: 11px; font-weight: 600; padding: 3px 6px; border-radius: 6px; margin-bottom: 2px; cursor: pointer; }

  @keyframes slideIn { from { opacity:0; transform: translateX(10px); } to { opacity:1; transform: translateX(0); } }
  .tc-slide { animation: slideIn .2s ease-out; }

  .tc-sidebar-event { padding: 10px 14px; border-radius: 12px; border-left: 4px solid; margin-bottom: 8px; background: #fff; cursor: pointer; transition: all .15s; }
  .tc-sidebar-event:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
`;

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
  const [createDate, setCreateDate] = useState<Date | null>(null);
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

      // Fetch calendar events
      const { data: evts } = await supabase
        .from("calendar_events").select("*")
        .eq("institute_id", member.institute_id)
        .order("start_time");

      // Fetch assignments with deadlines (auto-show as calendar events)
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
    setCreateDate(d);
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
    const day = startOfWeek.getDay(); // 0=Sun
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

  function getEventsForDay(date: Date) {
    return events.filter(e => {
      const evDate = new Date(e.start_time);
      return evDate.getFullYear() === date.getFullYear() &&
             evDate.getMonth() === date.getMonth() &&
             evDate.getDate() === date.getDate();
    });
  }

  /* ── Upcoming events (sidebar) ── */
  const upcoming = events
    .filter(e => new Date(e.start_time) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 8);

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <div className="tc-root">
      <style>{css}</style>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowCreate(false)}>
          <div className="tc-card tc-slide" style={{ width: "100%", maxWidth: 480, padding: 28 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800, color: "#1E293B" }}>📅 New Event</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input className="tc-field" placeholder="Event title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />

              {/* Type selector */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.id} className="tc-btn"
                    onClick={() => setForm({ ...form, event_type: t.id, color: t.color })}
                    style={{ background: form.event_type === t.id ? t.color : "#F1F5F9", color: form.event_type === t.id ? "#fff" : "#64748B", fontSize: 12, padding: "6px 12px" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <select className="tc-field" value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">All batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>START</label>
                  <input className="tc-field" type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 4 }}>END</label>
                  <input className="tc-field" type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} style={{ accentColor: "#6366F1" }} />
                <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>All day event</span>
              </div>

              {form.event_type === "meeting" && (
                <input className="tc-field" placeholder="Meeting link (Google Meet / Zoom)" value={form.meeting_link} onChange={e => setForm({ ...form, meeting_link: e.target.value })} />
              )}

              <textarea className="tc-field" rows={2} placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: "vertical" }} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                <button className="tc-btn tc-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="tc-btn tc-primary" onClick={handleCreate} disabled={saving || !form.title.trim()}>
                  {saving ? "Creating..." : "✓ Create Event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSelectedEvent(null)}>
          <div className="tc-card tc-slide" style={{ width: "100%", maxWidth: 420, padding: 28 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: selectedEvent.color }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E293B", flex: 1 }}>{selectedEvent.title}</h3>
              <button className="tc-btn tc-ghost" style={{ padding: "4px 8px" }} onClick={() => setSelectedEvent(null)}>✕</button>
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
                <button className="tc-btn" style={{ background: "#FEE2E2", color: "#DC2626" }} onClick={() => deleteEvent(selectedEvent.id)}>🗑️ Delete</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1E293B" }}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="tc-btn tc-ghost" style={{ padding: "6px 10px" }} onClick={viewMode === "month" ? prevMonth : prevWeek}>‹</button>
            <button className="tc-btn tc-ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={goToday}>Today</button>
            <button className="tc-btn tc-ghost" style={{ padding: "6px 10px" }} onClick={viewMode === "month" ? nextMonth : nextWeek}>›</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 2, background: "#F1F5F9", borderRadius: 10, padding: 2 }}>
            <button className="tc-btn" style={{ background: viewMode === "month" ? "#fff" : "transparent", color: viewMode === "month" ? "#1E293B" : "#94A3B8", boxShadow: viewMode === "month" ? "0 1px 4px rgba(0,0,0,0.1)" : "none", fontSize: 12, padding: "6px 14px" }} onClick={() => setViewMode("month")}>Month</button>
            <button className="tc-btn" style={{ background: viewMode === "week" ? "#fff" : "transparent", color: viewMode === "week" ? "#1E293B" : "#94A3B8", boxShadow: viewMode === "week" ? "0 1px 4px rgba(0,0,0,0.1)" : "none", fontSize: 12, padding: "6px 14px" }} onClick={() => setViewMode("week")}>Week</button>
          </div>
          <button className="tc-btn tc-primary" onClick={() => openCreate()}>+ Add Event</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
        {/* ── Calendar Grid ── */}
        <div className="tc-card" style={{ padding: 16, overflow: "hidden" }}>
          {viewMode === "month" ? (
            <>
              <div className="tc-month-grid" style={{ marginBottom: 4 }}>
                {DAYS.map(d => <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>{d}</div>)}
              </div>
              <div className="tc-month-grid">
                {monthGrid.map((cell, i) => {
                  const dayEvents = getEventsForDay(cell.date);
                  const isToday = sameDay(cell.date, today);
                  return (
                    <div key={i}
                      className={`tc-day-cell ${isToday ? "today" : ""} ${!cell.isCurrentMonth ? "other-month" : ""}`}
                      onClick={() => openCreate(cell.date)}>
                      <div className={`tc-day-num ${isToday ? "today" : ""}`}>{cell.date.getDate()}</div>
                      {dayEvents.slice(0, 3).map(e => (
                        <div key={e.id} className="tc-event-dot"
                          style={{ background: e.color + "20", color: e.color }}
                          onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); }}>
                          {e.title.length > 14 ? e.title.slice(0, 14) + "…" : e.title}
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
            <div style={{ overflowX: "auto" }}>
              {/* Week header */}
              <div className="tc-week-grid">
                <div />
                {weekDays.map((d, i) => (
                  <div key={i} className={`tc-week-header ${sameDay(d, today) ? "today" : ""}`}>
                    <div style={{ fontSize: 11, textTransform: "uppercase" }}>{DAYS[d.getDay()]}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: sameDay(d, today) ? "#6366F1" : "#1E293B" }}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              {/* Time slots */}
              {hours.map(h => (
                <div key={h} className="tc-week-grid">
                  <div className="tc-time-label">{h > 12 ? h-12 : h}{h >= 12 ? "PM" : "AM"}</div>
                  {weekDays.map((d, di) => {
                    const dayEvts = getEventsForDay(d).filter(e => {
                      if (e.all_day) return h === 7; // show all-day events at 7am row
                      const dt = new Date(e.start_time);
                      const eHour = dt.getHours(); // local timezone
                      return eHour === h;
                    });
                    return (
                      <div key={di} className="tc-week-cell" onClick={() => {
                        const clickDate = new Date(d);
                        clickDate.setHours(h, 0, 0, 0);
                        openCreate(clickDate);
                      }}>
                        {dayEvts.map(e => (
                          <div key={e.id} className="tc-week-event"
                            style={{ background: e.color + "20", color: e.color, borderLeft: `3px solid ${e.color}` }}
                            onClick={ev => { ev.stopPropagation(); setSelectedEvent(e); }}>
                            {fmtTime(e.start_time)} {e.title.length > 16 ? e.title.slice(0, 16) + "…" : e.title}
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
        <div>
          {/* Mini calendar */}
          <div className="tc-card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1E293B" }}>
                {MONTHS[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}
              </span>
              <div style={{ display: "flex", gap: 2 }}>
                <button className="tc-btn tc-ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={prevMonth}>‹</button>
                <button className="tc-btn tc-ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={nextMonth}>›</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, textAlign: "center" }}>
              {DAYS.map(d => <div key={d} style={{ fontSize: 9, fontWeight: 700, color: "#CBD5E1", padding: "2px 0" }}>{d[0]}</div>)}
              {monthGrid.slice(0, 35).map((cell, i) => {
                const isToday = sameDay(cell.date, today);
                const hasEvents = getEventsForDay(cell.date).length > 0;
                return (
                  <div key={i} style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: !cell.isCurrentMonth ? "#CBD5E1" : isToday ? "#fff" : "#475569", background: isToday ? "#6366F1" : "transparent", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", cursor: "pointer", position: "relative" }}
                    onClick={() => setCurrentDate(cell.date)}>
                    {cell.date.getDate()}
                    {hasEvents && !isToday && <div style={{ position: "absolute", bottom: 0, width: 4, height: 4, borderRadius: "50%", background: "#6366F1" }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="tc-card" style={{ padding: 16 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#1E293B" }}>Upcoming Events</h4>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>No upcoming events</p>
            ) : (
              upcoming.map(e => (
                <div key={e.id} className="tc-sidebar-event" style={{ borderLeftColor: e.color }}
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
          <div className="tc-card" style={{ padding: 14, marginTop: 12 }}>
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
    </div>
  );
}