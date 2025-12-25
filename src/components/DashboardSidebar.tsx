
// src/components/DashboardSidebar.tsx
import React, { useMemo, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion, type Variants, type TargetAndTransition } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileText, BarChart2, Users, Bookmark, Settings, LayoutDashboard,
  ChevronRight, Zap, Trophy, Notebook, CalendarDays, Users2,
  Sparkles, Plus, Menu, X,
} from "lucide-react";

/* ---------------- Cluely theme tokens ---------------- */
const theme = {
  mist: "#DFE4EF",
  slate600: "#5D6B7B",
  ink800: "#2F3A44",
  gradFrom: "from-[#5D6B7B]",
  gradTo: "to-[#2F3A44]",
  textAccent: "text-[#4E5A66]",
  textAccentHover: "group-hover:text-[#2F3A44]",
  hoverTint: "hover:bg-[#DFE4EF]/70 dark:hover:bg-slate-800/60",
  borderAccent: "border-[#DFE4EF] dark:border-slate-700",
  pillShadowAccent: "shadow-[0_10px_24px_rgba(47,58,68,0.18)]",
};

/* ---------------- Motion presets ---------------- */
const enterFromLeft: Variants = {
  hidden: { x: -12, opacity: 0 },
  show: (i: number) => ({
    x: 0,
    opacity: 1,
    transition: { delay: 0.02 * i, type: "spring" as const, stiffness: 280, damping: 22 },
  }),
};
const hoverLift: TargetAndTransition = {
  scale: 1.02,
  x: 6,
  transition: { type: "spring" as const, stiffness: 320, damping: 16 },
};

/* ---------------- Types ---------------- */
interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  alert?: boolean;
  premium?: boolean;
  index: number;
}

/* ---------------- Item ---------------- */
const SidebarItem = React.memo(function SidebarItem({
  icon: Icon, label, to, alert, premium, index,
}: SidebarItemProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      custom={index}
      variants={enterFromLeft}
      initial="hidden"
      animate="show"
      whileHover={!prefersReducedMotion ? hoverLift : undefined}
      whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
      className="relative"
    >
      {alert && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background"
          aria-hidden
        />
      )}

      {premium && (
        <motion.span
          aria-hidden
          animate={!prefersReducedMotion ? { rotate: [0, 10, -10, 0] } : {}}
          transition={{ repeat: Infinity, duration: 2.2 }}
          className="absolute -right-2 -top-2"
        >
          <Sparkles className="h-3 w-3 text-amber-400 fill-amber-400" />
        </motion.span>
      )}

      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            "group relative flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300",
            !isActive && theme.hoverTint,
            isActive ? "text-white" : "text-muted-foreground",
            premium && !isActive && "border-l-4 border-amber-400/80",
            isActive &&
              cn(
                "bg-gradient-to-r", theme.gradFrom, theme.gradTo,
                theme.pillShadowAccent, "ring-1 ring-white/30 dark:ring-white/10"
              )
          )
        }
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full transition-opacity md:block",
                isActive ? "bg-white/90 opacity-100" : "opacity-0"
              )}
            />
            <Icon
              className={cn(
                "h-5 w-5 transition-transform duration-300",
                isActive ? "text-white" : cn("text-muted-foreground", theme.textAccentHover),
                premium && !isActive && "text-amber-500 group-hover:text-amber-600"
              )}
            />
            <span className="text-[0.95rem] font-medium flex-1">{label}</span>
            <ChevronRight
              className={cn(
                "h-4 w-4 opacity-0 transition-all duration-300",
                isActive ? "text-white opacity-100" : "group-hover:opacity-100 " + theme.textAccentHover
              )}
              aria-hidden
            />
          </>
        )}
      </NavLink>
    </motion.div>
  );
});

/* ---------------- Data ---------------- */
const useSidebarData = () =>
  useMemo(
    () => ({
      items: [
        { icon: LayoutDashboard, label: "Overview", to: "/dashboard" },
        { icon: FileText, label: "Test Generator", to: "/dashboard/test-generator", alert: true },
        { icon: Trophy, label: "Contests", to: "/dashboard/contests", premium: true },
        { icon: BarChart2, label: "Analytics", to: "/dashboard/analytics" },
        { icon: Users, label: "Students", to: "/dashboard/students", alert: true },
        { icon: Notebook, label: "Notes", to: "/dashboard/notes" }, // <-- list page
        { icon: Settings, label: "Settings", to: "/dashboard/settings" },
      ],
      contestInfo: {
        title: "Class 11 Physics Test 2025",
        deadline: "2025-05-10",
        participants: 250,
        prize1: "₹500",
        prize2: "₹300",
        premium: true,
      },
      notesSummary: { unread: 3, recentSubject: "Algebra II", lastUpdated: "2 hours ago", starred: 5 },
    }),
    []
  );

/* ---------------- Featured Contest ---------------- */
const FeaturedContest = React.memo(function FeaturedContest({
  contest,
}: {
  contest: { title: string; deadline: string; participants: number; prize1: string; prize2: string; premium?: boolean };
}) {
  const dateStr = new Date(contest.deadline).toLocaleDateString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", delay: 0.05 }}
      className={cn(
        "mx-3 mb-4 rounded-xl border p-4",
        "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-[0_6px_16px_rgba(245,158,11,0.12)]",
        "dark:from-amber-900/10 dark:to-amber-800/10"
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-foreground">Featured Contest</h3>
        </div>
        {contest.premium && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <Sparkles className="h-3 w-3" /> Premium
          </span>
        )}
      </div>

      <p className="mb-1 text-sm font-medium text-foreground">{contest.title}</p>

      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-amber-500" />
          <span>Date {dateStr}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users2 className="h-4 w-4 text-amber-500" />
          <span>{contest.participants.toLocaleString()} participants</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
          <Zap className="h-4 w-4" />
          <span>1st Prize: {contest.prize1}</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
          <Zap className="h-4 w-4" />
          <span>2nd Prize: {contest.prize2}</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
          <Zap className="h-4 w-4" />
          <span>Goodies to Top 15</span>
        </div>
      </div>

      <Link to="/dashboard/contests" className="block">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: "0 6px 16px rgba(245,158,11,0.28)" }}
          whileTap={{ scale: 0.98 }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-white transition-all bg-gradient-to-r from-amber-500 to-amber-600"
        >
          <Trophy className="h-4 w-4" />
          Register Now
        </motion.button>
      </Link>
    </motion.div>
  );
});

/* ---------------- Notes Quick ---------------- */
const NotesQuick = React.memo(function NotesQuick({
  unread, recentSubject, lastUpdated, starred,
}: { unread: number; recentSubject: string; lastUpdated: string; starred: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", delay: 0.1 }}
      className={cn(
        "mx-3 mb-6 rounded-xl border p-4",
        theme.borderAccent,
        "bg-gradient-to-br from-white to-[#DFE4EF]/60 dark:from-slate-800/40 dark:to-slate-800/20",
        "shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Notebook className={cn("h-5 w-5", theme.textAccent)} />
          <h3 className="font-semibold text-foreground">My Notes</h3>
        </div>
        <div className="flex gap-1">
          {unread > 0 && (
            <span className="rounded-full bg-[#DFE4EF] px-2 py-1 text-xs font-medium text-[#2F3A44] dark:bg-slate-700 dark:text-slate-100">
              {unread} new
            </span>
          )}
          {starred > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              <Sparkles className="h-3 w-3" />
              {starred}
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 space-y-2 text-sm text-muted-foreground">
        <p>
          Last updated: <span className="font-medium text-[#2F3A44] dark:text-slate-200">{lastUpdated}</span>
        </p>
        <p>
          Recent subject: <span className="font-medium text-[#2F3A44] dark:text-slate-200">{recentSubject}</span>
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <Link to="/dashboard/notes" className="flex-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border bg-background py-2 text-sm",
              theme.borderAccent, theme.textAccent
            )}
          >
            <Bookmark className="h-4 w-4" />
            View All
          </motion.button>
        </Link>
        <Link to="/dashboard/notes/new" className="flex-1">
          {/* BLACK primary */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 6px 16px rgba(0,0,0,0.35)" }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-white transition-all bg-gradient-to-b from-[#1F2937] to-[#0B1220]"
          >
            <Plus className="h-4 w-4" />
            Note It !
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
});

/* ---------------- Sidebar content ---------------- */
function SidebarContent() {
  const { items, contestInfo, notesSummary } = useSidebarData();
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      {/* Logo */}
      <motion.div className="p-6" whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined} transition={{ type: "spring", stiffness: 400 }}>
        <Link
          to="/"
          className={cn("flex items-center gap-2 text-2xl font-bold bg-gradient-to-r", theme.gradFrom, theme.gradTo, "bg-clip-text text-transparent")}
        >
          <motion.div animate={!prefersReducedMotion ? { rotate: [0, 10, -10, 0] } : {}} transition={{ repeat: Infinity, duration: 3 }}>
            <Zap className="h-6 w-6 text-[#5D6B7B]" />
          </motion.div>
          a4ai
        </Link>
      </motion.div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item, i) => (
          <SidebarItem key={item.to} icon={item.icon} label={item.label} to={item.to} alert={item.alert} premium={item.premium} index={i} />
        ))}
      </nav>

      <FeaturedContest contest={contestInfo} />
      <NotesQuick {...notesSummary} />
    </>
  );
}

/* ---------------- Responsive Sidebar ---------------- */
interface DashboardSidebarProps {
  onClose?: () => void;
}

export default function DashboardSidebar({ onClose }: DashboardSidebarProps) {
  useLocation(); // rerender on route change
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed left-3 top-3 z-50 inline-flex h-10 w-10 items-center justify-center rounded-md border bg-background shadow-sm"
        aria-label="Open sidebar"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <motion.aside
        key="desktop"
        initial={{ x: -90, opacity: 0 }}
        animate={{ x: 0, opacity: 1, transition: { type: "spring", stiffness: 110, damping: 20 } }}
        exit={{ x: -90, opacity: 0 }}
        className="sticky top-0 hidden h-[100dvh] w-64 md:flex md:flex-col overflow-y-auto border-r border-border bg-background"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="md:hidden fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
            />
            <motion.aside
              key="mobile"
              role="dialog"
              aria-modal="true"
              className="md:hidden fixed inset-y-0 left-0 z-[60] w-80 max-w-[85vw] bg-background border-r border-border shadow-xl flex flex-col"
              initial={{ x: -320, opacity: 1 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-semibold">Menu</div>
                <button
                  aria-label="Close sidebar"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarContent />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
