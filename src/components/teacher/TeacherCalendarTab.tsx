// src/components/teacher/TeacherCalendarTab.tsx
// Modern responsive calendar for teachers with Month, Week, and Mobile-first Agenda views
// Auto-syncs assignment deadlines & calendar events from Supabase

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Clock,
  Trash2,
  X,
  BookOpen,
  CalendarDays,
  ListFilter,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

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
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/* ─── Helpers ───────────────────────────── */
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function TeacherCalendarTab() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [instituteId, setInstituteId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "event",
    start_time: "",
    end_time: "",
    all_day: false,
    meeting_link: "",
    batch_id: "",
    color: "#6366F1",
  });
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!instituteId) return;
    const ch = supabase
      .channel(`teacher-calendar-${instituteId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => loadData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [instituteId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: member } = await supabase
        .from("institute_members")
        .select("institute_id")
        .eq("user_id", user?.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!member) {
        setLoading(false);
        return;
      }
      setInstituteId(member.institute_id);

      const { data: bRows } = await supabase
        .from("batches")
        .select("id, name")
        .eq("institute_id", member.institute_id)
        .eq("is_active", true)
        .order("name");

      if (bRows) setBatches(bRows);
      const batchMap: Record<string, string> = {};
      bRows?.forEach((b) => (batchMap[b.id] = b.name));

      // Fetch calendar events
      const { data: evts } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("institute_id", member.institute_id)
        .order("start_time");

      // Fetch assignments with deadlines (auto-show as calendar events)
      const { data: asgns } = await supabase
        .from("assignments")
        .select("id, title, batch_id, deadline, max_marks")
        .eq("institute_id", member.institute_id)
        .eq("status", "active")
        .not("deadline", "is", null);

      const calEvents: CalendarEvent[] = [];

      if (evts) {
        evts.forEach((e) =>
          calEvents.push({
            ...e,
            batch_name: e.batch_id ? batchMap[e.batch_id] || "" : "All",
          })
        );
      }

      if (asgns) {
        asgns.forEach((a) => {
          if (a.deadline) {
            calEvents.push({
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
          }
        });
      }

      calEvents.sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      setEvents(calEvents);
    } catch (e) {
      console.error("Calendar loadData error:", e);
    }
    setLoading(false);
  }

  /* ── Create Event ── */
  function openCreate(date?: Date) {
    const d = date || selectedDate || new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm({
      title: "",
      description: "",
      event_type: "event",
      start_time: iso,
      end_time: "",
      all_day: false,
      meeting_link: "",
      batch_id: "",
      color: "#6366F1",
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
      toast.success("Event created successfully!");
      setShowCreate(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to create event");
    }
    setSaving(false);
  }

  async function deleteEvent(id: string) {
    if (!confirm("Are you sure you want to delete this event?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    setSelectedEvent(null);
    loadData();
  }

  /* ── Navigation ── */
  function prevPeriod() {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
    } else {
      // Agenda step by month
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  }

  function nextPeriod() {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  }

  function goToday() {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }

  /* ── Month Grid Data ── */
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, daysInPrev - i),
        isCurrentMonth: false,
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return cells;
  }, [currentDate]);

  /* ── Week Grid Data ── */
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
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
    return events.filter((e) => {
      const evDate = new Date(e.start_time);
      return (
        evDate.getFullYear() === date.getFullYear() &&
        evDate.getMonth() === date.getMonth() &&
        evDate.getDate() === date.getDate()
      );
    });
  }

  /* ── Events on Selected Date (for Mobile Month View) ── */
  const selectedDayEvents = useMemo(() => {
    return getEventsForDay(selectedDate);
  }, [selectedDate, events]);

  /* ── Upcoming events ── */
  const upcoming = useMemo(() => {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return events
      .filter((e) => new Date(e.start_time) >= startOfToday)
      .slice(0, 10);
  }, [events, today]);

  /* ── Agenda Grouping (for Agenda View) ── */
  const agendaGroups = useMemo(() => {
    const groups: { date: Date; dateStr: string; events: CalendarEvent[] }[] = [];
    const dateMap = new Map<string, CalendarEvent[]>();

    events.forEach((ev) => {
      const d = new Date(ev.start_time);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key)!.push(ev);
    });

    dateMap.forEach((evs, key) => {
      const [y, m, d] = key.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      groups.push({
        date: dateObj,
        dateStr: dateObj.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        events: evs,
      });
    });

    groups.sort((a, b) => a.date.getTime() - b.date.getTime());
    return groups;
  }, [events]);

  return (
    <div className="tc-root space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* ── CREATE EVENT MODAL ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-pop"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[28px] sm:rounded-[36px] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Create New Event
                </h3>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Event Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Physics Chapter 3 Quiz or Parent Meeting"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Event Type selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Event Category
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {EVENT_TYPES.map((t) => {
                    const isSelected = form.event_type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, event_type: t.id, color: t.color })
                        }
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                            : "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-base">{t.icon}</span>
                        <span className="text-[10px] mt-0.5">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Batch Selector */}
              {batches.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Assign To Batch
                  </label>
                  <select
                    value={form.batch_id}
                    onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Batches (Public)</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Start Time *
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    End Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* All day toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="all-day-toggle"
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <label
                  htmlFor="all-day-toggle"
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  All-day event
                </label>
              </div>

              {/* Meeting Link for Meeting type */}
              {form.event_type === "meeting" && (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Google Meet / Zoom URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/xyz-abc"
                    value={form.meeting_link}
                    onChange={(e) =>
                      setForm({ ...form, meeting_link: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional agenda or student instructions..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.title.trim()}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? "Creating..." : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EVENT DETAIL MODAL ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-pop"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[28px] sm:rounded-[36px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedEvent.color }}
                />
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                  {selectedEvent.event_type}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
              {selectedEvent.title}
            </h3>

            <div className="space-y-3 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-6">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  {new Date(selectedEvent.start_time).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>

              {!selectedEvent.all_day && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>
                    {fmtTime(selectedEvent.start_time)}
                    {selectedEvent.end_time ? ` — ${fmtTime(selectedEvent.end_time)}` : ""}
                  </span>
                </div>
              )}

              {selectedEvent.batch_name && (
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Batch: {selectedEvent.batch_name}</span>
                </div>
              )}

              {selectedEvent.description && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {selectedEvent.description}
                </div>
              )}

              {selectedEvent.meeting_link && (
                <div className="pt-2">
                  <a
                    href={selectedEvent.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm hover:bg-blue-100 transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Meeting Online</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/10">
              {!selectedEvent.is_assignment ? (
                <button
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  Auto-synced from Assignment
                </span>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:opacity-90 transition-opacity ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESPONSIVE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-xs">
        {/* Month Title & Nav */}
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={prevPeriod}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs rounded-xl transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={nextPeriod}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs transition-all cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Switcher & Add Button */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Mode Pills: Month | Week | Agenda */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            {(["month", "week", "agenda"] as const).map((mode) => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                    isActive
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-extrabold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>

          {/* Add Event Button */}
          <button
            onClick={() => openCreate(selectedDate)}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Event</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT GRID (Responsive 1-Col on Mobile, 2-Col on Desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* LEFT COLUMN: Main Calendar View */}
        <div className="w-full min-w-0 space-y-6">
          {/* 1. MONTH VIEW */}
          {viewMode === "month" && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-[28px] sm:rounded-[36px] p-3 sm:p-6 shadow-xs overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                {DAYS.map((d) => (
                  <div
                    key={d}
                    className="text-center py-2 text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider"
                  >
                    <span className="sm:hidden">{d[0]}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>

              {/* 7-Column Month Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {monthGrid.map((cell, idx) => {
                  const dayEvents = getEventsForDay(cell.date);
                  const isToday = sameDay(cell.date, today);
                  const isSelected = sameDay(cell.date, selectedDate);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(cell.date);
                      }}
                      className={`relative min-h-[50px] sm:min-h-[92px] p-1 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700"
                          : isToday
                          ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40"
                          : !cell.isCurrentMonth
                          ? "opacity-30 border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                          : "border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Date Number */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                            isToday
                              ? "bg-indigo-600 text-white shadow-xs"
                              : isSelected
                              ? "text-indigo-600 dark:text-indigo-400 font-black"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        {/* Desktop event count badge */}
                        {dayEvents.length > 0 && (
                          <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400">
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* MOBILE VIEW INDICATORS: Color dots */}
                      <div className="flex sm:hidden items-center justify-center gap-1 mt-1 flex-wrap min-h-[6px]">
                        {dayEvents.slice(0, 3).map((e, eIdx) => (
                          <div
                            key={eIdx}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: e.color }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] font-black text-slate-400 leading-none">
                            +
                          </span>
                        )}
                      </div>

                      {/* DESKTOP VIEW: Full event chips */}
                      <div className="hidden sm:flex flex-col gap-1 mt-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setSelectedEvent(e);
                            }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md truncate transition-transform hover:scale-[1.02] cursor-pointer"
                            style={{
                              backgroundColor: `${e.color}18`,
                              color: e.color,
                            }}
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] font-bold text-slate-400 px-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MOBILE DAY AGENDA: Tapping any date reveals events below calendar */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 sm:hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {sameDay(selectedDate, today)
                        ? "Today's Schedule"
                        : selectedDate.toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                    </h4>
                  </div>
                  <button
                    onClick={() => openCreate(selectedDate)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                    <p className="text-xs font-medium text-slate-400 mb-2">
                      No events scheduled for this day
                    </p>
                    <button
                      onClick={() => openCreate(selectedDate)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Plan an event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEvent(e)}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-2.5 h-8 rounded-full shrink-0"
                            style={{ backgroundColor: e.color }}
                          />
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {e.title}
                            </h5>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              {!e.all_day ? fmtTime(e.start_time) : "All-day"}
                              {e.batch_name ? ` · ${e.batch_name}` : ""}
                            </p>
                          </div>
                        </div>
                        {e.meeting_link && (
                          <div className="shrink-0 text-blue-600 dark:text-blue-400">
                            <Video className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. WEEK VIEW (Scrollable table on mobile, rich layout on desktop) */}
          {viewMode === "week" && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 shadow-xs overflow-hidden">
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[640px]">
                  {/* Week Header */}
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-0 border-b border-slate-100 dark:border-white/10 pb-2">
                    <div />
                    {weekDays.map((d, i) => {
                      const isToday = sameDay(d, today);
                      return (
                        <div
                          key={i}
                          className={`text-center py-2 ${
                            isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="text-[11px] uppercase font-bold text-slate-400">
                            {DAYS[d.getDay()]}
                          </div>
                          <div
                            className={`text-base font-black w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-0.5 ${
                              isToday
                                ? "bg-indigo-600 text-white"
                                : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {d.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hourly Time Slots */}
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="grid grid-cols-[60px_repeat(7,1fr)] gap-0 min-h-[52px]"
                      >
                        <div className="text-[10px] font-bold text-slate-400 pr-2 pt-1 text-right select-none">
                          {h > 12 ? h - 12 : h} {h >= 12 ? "PM" : "AM"}
                        </div>

                        {weekDays.map((d, di) => {
                          const slotEvents = getEventsForDay(d).filter((e) => {
                            if (e.all_day) return h === 7;
                            const dt = new Date(e.start_time);
                            return dt.getHours() === h;
                          });

                          return (
                            <div
                              key={di}
                              onClick={() => {
                                const clickDate = new Date(d);
                                clickDate.setHours(h, 0, 0, 0);
                                openCreate(clickDate);
                              }}
                              className="border-l border-slate-100 dark:border-white/5 p-1 relative hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                            >
                              {slotEvents.map((e) => (
                                <div
                                  key={e.id}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setSelectedEvent(e);
                                  }}
                                  className="text-[10px] font-bold p-1 rounded-md mb-1 truncate border-l-2 shadow-xs cursor-pointer"
                                  style={{
                                    backgroundColor: `${e.color}18`,
                                    color: e.color,
                                    borderLeftColor: e.color,
                                  }}
                                >
                                  {fmtTime(e.start_time)} {e.title}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. AGENDA (LIST) VIEW — Clean Mobile-First Chronological Feed */}
          {viewMode === "agenda" && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-[28px] sm:rounded-[36px] p-4 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Chronological Agenda
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    All upcoming classes, assignment deadlines, tests & meetings
                  </p>
                </div>
                <button
                  onClick={() => openCreate()}
                  className="px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-100 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New
                </button>
              </div>

              {agendaGroups.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-500">
                    No scheduled events or deadlines found.
                  </p>
                  <button
                    onClick={() => openCreate()}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Create Your First Event
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {agendaGroups.map((group, gIdx) => {
                    const isToday = sameDay(group.date, today);
                    return (
                      <div key={gIdx} className="space-y-2.5">
                        {/* Date Divider */}
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                              isToday
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {isToday ? "Today" : group.dateStr}
                          </span>
                          <div className="h-px bg-slate-200 dark:bg-white/10 flex-1" />
                        </div>

                        {/* Events on this date */}
                        <div className="space-y-2 pl-2">
                          {group.events.map((e) => (
                            <div
                              key={e.id}
                              onClick={() => setSelectedEvent(e)}
                              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group hover:shadow-md"
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform"
                                  style={{ backgroundColor: `${e.color}20` }}
                                >
                                  {EVENT_TYPES.find((t) => t.id === e.event_type)?.icon || "📅"}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                      {e.title}
                                    </h4>
                                    <span
                                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${e.color}20`,
                                        color: e.color,
                                      }}
                                    >
                                      {e.event_type}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {!e.all_day
                                      ? `${fmtTime(e.start_time)}${e.end_time ? ` - ${fmtTime(e.end_time)}` : ""}`
                                      : "All Day"}
                                    {e.batch_name ? ` · Batch: ${e.batch_name}` : ""}
                                    {e.description ? ` · ${e.description}` : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                {e.meeting_link && (
                                  <a
                                    href={e.meeting_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(ev) => ev.stopPropagation()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold text-xs hover:bg-blue-100 transition-colors"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>Join</span>
                                  </a>
                                )}
                                {!e.is_assignment && (
                                  <button
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      deleteEvent(e.id);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                    title="Delete event"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar (Desktop side panel; stacks neatly below on mobile) */}
        <div className="w-full space-y-6">
          {/* Mini Calendar Picker (Desktop only to prevent redundant display on mobile) */}
          <div className="hidden lg:block bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-[28px] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {MONTHS[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevPeriod}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextPeriod}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {DAYS.map((d) => (
                <div key={d} className="text-[10px] font-bold text-slate-400 py-1">
                  {d[0]}
                </div>
              ))}
              {monthGrid.slice(0, 35).map((cell, i) => {
                const isToday = sameDay(cell.date, today);
                const isSelected = sameDay(cell.date, selectedDate);
                const hasEvents = getEventsForDay(cell.date).length > 0;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDate(cell.date);
                      setCurrentDate(cell.date);
                    }}
                    className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center mx-auto transition-colors relative ${
                      isToday
                        ? "bg-indigo-600 text-white"
                        : isSelected
                        ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold"
                        : !cell.isCurrentMonth
                        ? "text-slate-300 dark:text-slate-600"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {cell.date.getDate()}
                    {hasEvents && !isToday && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upcoming Events Box */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-[28px] p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Upcoming Deadlines & Classes
              </h4>
            </div>

            {upcoming.length === 0 ? (
              <p className="text-xs font-medium text-slate-400 text-center py-6">
                No upcoming events scheduled
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {e.title}
                      </h5>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: e.color }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      {fmtDate(new Date(e.start_time))} {!e.all_day && `· ${fmtTime(e.start_time)}`}
                      {e.batch_name ? ` · ${e.batch_name}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Categories Legend */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-[28px] p-5 shadow-xs">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Event Categories
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
              {EVENT_TYPES.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                  <span>
                    {t.icon} {t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}