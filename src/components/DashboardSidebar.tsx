// src/components/DashboardSidebar.tsx
import React, { useMemo } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileText,
  BarChart2,
  Users,
  Bookmark,
  Settings,
  LayoutDashboard,
  ChevronRight,
  Zap,
  Trophy,
  Notebook,
  CalendarDays,
  Users2,
  Sparkles,
  Plus,
} from "lucide-react";

/* ---------------- Motion presets (shared, consistent) ---------------- */
const enterFromLeft = {
  hidden: { x: -12, opacity: 0 },
  show: (i: number) => ({
    x: 0,
    opacity: 1,
    transition: { delay: 0.02 * i, type: "spring", stiffness: 280, damping: 22 },
  }),
};

const hoverLift = { scale: 1.02, x: 6, transition: { type: "spring", stiffness: 320, damping: 16 } };

/* ---------------- Types ---------------- */
interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  alert?: boolean;
  premium?: boolean;
  index: number;
}

/* ---------------- Memo Sidebar Item ---------------- */
const SidebarItem = React.memo(function SidebarItem({
  icon: Icon,
  label,
  to,
  alert,
  premium,
  index,
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
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
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
            "group flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300",
            isActive
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
              : "text-gray-700 hover:bg-gray-50 hover:text-purple-600",
            premium && "border-l-4 border-amber-400"
          )
        }
        aria-label={label}
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn(
                "h-5 w-5 transition-transform duration-300",
                isActive ? "text-white" : "text-gray-400 group-hover:text-purple-500",
                premium && !isActive && "text-amber-500 group-hover:text-amber-600"
              )}
            />
            <span className="text-[0.95rem] font-medium flex-1">{label}</span>
            <ChevronRight
              className={cn(
                "h-4 w-4 opacity-0 transition-all duration-300",
                isActive ? "text-white opacity-100" : "group-hover:opacity-100 group-hover:text-purple-500"
              )}
              aria-hidden
            />
          </>
        )}
      </NavLink>
    </motion.div>
  );
});

/* ---------------- Data (memoized) ---------------- */
const useSidebarData = () =>
  useMemo(
    () => ({
      items: [
        { icon: LayoutDashboard, label: "Overview", to: "/dashboard" },
        { icon: FileText, label: "Test Generator", to: "/dashboard/test-generator", alert: true },
        { icon: Trophy, label: "Contests", to: "/dashboard/contests", premium: true },
        { icon: BarChart2, label: "Analytics", to: "/dashboard/analytics" },
        { icon: Users, label: "Students", to: "/dashboard/students", alert: true },
        { icon: Notebook, label: "Notes", to: "/dashboard/notes" },
        { icon: Settings, label: "Settings", to: "/dashboard/settings" },
      ],
      contestInfo: {
        title: "Class 10 Science Test 2025",
        deadline: "2025-07-25",
        participants: 300,
        prize1: "₹5,000",
        prize2: "₹2,000",
        premium: true,
      },
      notesSummary: { unread: 3, recentSubject: "Algebra II", lastUpdated: "2 hours ago", starred: 5 },
    }),
    []
  );

/* ---------------- Featured Contest + Notes (split, memo) ---------------- */
const FeaturedContest = React.memo(function FeaturedContest({
  contest,
}: {
  contest: {
    title: string;
    deadline: string;
    participants: number;
    prize1: string;
    prize2: string;
    premium?: boolean;
  };
}) {
  const dateStr = new Date(contest.deadline).toLocaleDateString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", delay: 0.05 }}
      className={cn(
        "mx-3 mb-4 rounded-xl border p-4",
        contest.premium
          ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-[0_4px_12px_rgba(245,158,11,0.10)]"
          : "bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200"
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Trophy className={cn("h-5 w-5", contest.premium ? "text-amber-600" : "text-amber-500")} />
          <h3 className="font-semibold text-gray-800">Featured Contest</h3>
        </div>
        {contest.premium && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            <Sparkles className="h-3 w-3" /> Premium
          </span>
        )}
      </div>

      <p className="mb-1 text-sm font-medium text-gray-800">{contest.title}</p>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <CalendarDays className="h-4 w-4 text-amber-500" />
          <span>Date {dateStr}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Users2 className="h-4 w-4 text-amber-500" />
          <span>{contest.participants.toLocaleString()} participants</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-amber-700">
          <Zap className="h-4 w-4" />
          <span>1st Prize: {contest.prize1}</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-amber-700">
          <Zap className="h-4 w-4" />
          <span>2nd Prize: {contest.prize2}</span>
        </div>
        <div className="flex items-center gap-2 font-medium text-amber-700">
          <Zap className="h-4 w-4" />
          <span>Goodies to Top 15</span>
        </div>
      </div>

      <Link to="/dashboard/contests" className="block">
        <motion.button
          whileHover={{
            scale: 1.02,
            boxShadow: contest.premium
              ? "0 4px 12px rgba(245, 158, 11, 0.30)"
              : "0 4px 12px rgba(245, 158, 11, 0.20)",
          }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-white transition-all",
            contest.premium ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-md" : "bg-gradient-to-r from-amber-400 to-amber-500"
          )}
        >
          <Trophy className="h-4 w-4" />
          Register Now
        </motion.button>
      </Link>
    </motion.div>
  );
});

const NotesQuick = React.memo(function NotesQuick({
  unread,
  recentSubject,
  lastUpdated,
  starred,
}: {
  unread: number;
  recentSubject: string;
  lastUpdated: string;
  starred: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", delay: 0.1 }}
      className="mx-3 mb-6 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 shadow-[0_4px_12px_rgba(124,58,237,0.1)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Notebook className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-800">My Notes</h3>
        </div>
        <div className="flex gap-1">
          {unread > 0 && (
            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">{unread} new</span>
          )}
          {starred > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              <Sparkles className="h-3 w-3" />
              {starred}
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 space-y-2 text-sm text-gray-600">
        <p>
          Last updated: <span className="font-medium text-purple-700">{lastUpdated}</span>
        </p>
        <p>
          Recent subject: <span className="font-medium text-purple-700">{recentSubject}</span>
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <Link to="/dashboard/notes" className="flex-1">
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: "rgba(249,250,251,1)" }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white py-2 text-sm text-purple-600 transition-all"
          >
            <Bookmark className="h-4 w-4" />
            View All
          </motion.button>
        </Link>
        <Link to="/dashboard/notes/new" className="flex-1">
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2 text-sm text-white transition-all"
          >
            <Plus className="h-4 w-4" />
            New Note
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
});

/* ---------------- Sidebar ---------------- */
export default function DashboardSidebar() {
  const { items, contestInfo, notesSummary } = useSidebarData();
  const location = useLocation(); // (kept to trigger re-render on route change)
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.aside
      initial={{ x: -90, opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: { type: "spring", stiffness: 110, damping: 20 } }}
      exit={{ x: -90, opacity: 0 }}
      className="sticky top-0 flex h-screen w-64 flex-col overflow-y-auto border-r border-gray-100 bg-white scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300"
    >
      {/* Logo */}
      <motion.div
        className="p-6"
        whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"
        >
          <motion.div
            animate={!prefersReducedMotion ? { rotate: [0, 10, -10, 0] } : {}}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <Zap className="h-6 w-6 text-purple-600" />
          </motion.div>
          a4ai
        </Link>
      </motion.div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item, i) => (
          <SidebarItem
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            alert={item.alert}
            premium={item.premium}
            index={i}
          />
        ))}
      </nav>

      <AnimatePresence>
        <FeaturedContest contest={contestInfo} />
        <NotesQuick {...notesSummary} />
      </AnimatePresence>
    </motion.aside>
  );
}
