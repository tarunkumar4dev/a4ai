import { Link, useLocation } from "react-router-dom";      // edited 19-06-2025
import { motion, AnimatePresence } from "framer-motion";
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
  AlertCircle,
  Sparkles,
  Plus,
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive?: boolean;
  alert?: boolean;
  premium?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, isActive, alert, premium }: SidebarItemProps) => (
  <motion.div
    whileHover={{ 
      scale: 1.02,
      x: 5,
      transition: { type: "spring", stiffness: 300, damping: 15 }
    }}
    whileTap={{ scale: 0.98 }}
    className="relative"
  >
    {alert && (
      <motion.span 
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
      />
    )}
    {premium && (
      <motion.span
        animate={{ 
          rotate: [0, 10, -10, 0],
          transition: { repeat: Infinity, duration: 2 }
        }}
        className="absolute -right-2 -top-2"
      >
        <Sparkles className="h-3 w-3 text-amber-400 fill-amber-400" />
      </motion.span>
    )}
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300 group",
        isActive
          ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
          : "text-gray-600 hover:bg-gray-50 hover:text-purple-600",
        premium && "border-l-4 border-amber-400"
      )}
    >
      <Icon className={cn(
        "h-5 w-5 transition-transform duration-300",
        isActive ? "text-white" : "text-gray-400 group-hover:text-purple-500",
        alert && !isActive ? "text-red-500" : "",
        premium && "text-amber-500 group-hover:text-amber-600"
      )} />
      <span className="text-md font-medium flex-1">{label}</span>
      <ChevronRight className={cn(
        "h-4 w-4 opacity-0 transition-all duration-300",
        isActive ? "text-white opacity-100" : "group-hover:opacity-100 group-hover:text-purple-500"
      )} />
    </Link>
  </motion.div>
);

const DashboardSidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: FileText, label: "Test Generator", href: "/dashboard/test-generator", alert: true },
    { icon: Trophy, label: "Contests", href: "/dashboard/contests", premium: true },
    { icon: BarChart2, label: "Analytics", href: "/dashboard/analytics" },
    { icon: Users, label: "Students", href: "/dashboard/students", alert: true },
    { icon: Notebook, label: "Notes", href: "/dashboard/notes" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  ];

  const contestInfo = {
    title: "Class 10 Science Test 2025",
    deadline: "2025-07-25",
    participants: 300,
    prize1: "₹5,000",
    prize2: "₹2,000",
    premium: true,
  };

  const notesSummary = {
    unread: 3,
    recentSubject: "Algebra II",
    lastUpdated: "2 hours ago",
    starred: 5
  };

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        transition: { type: "spring", stiffness: 100, damping: 20 }
      }}
      exit={{ x: -100, opacity: 0 }}
      className="w-64 border-r border-gray-100 bg-white flex flex-col h-screen sticky top-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
    >
      {/* Logo Header */}
      <motion.div 
        className="p-6"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Link 
          to="/" 
          className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"
        >
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 0],
              transition: { repeat: Infinity, duration: 3 }
            }}
          >
            <Zap className="h-6 w-6 text-purple-600" />
          </motion.div>
          a4ai
        </Link>
      </motion.div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {sidebarItems.map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={currentPath === item.href}
            alert={item.alert}
            premium={item.premium}
          />
        ))}
      </nav>

      <AnimatePresence>
        {/* Contest Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            transition: { delay: 0.2, type: "spring" }
          }}
          exit={{ opacity: 0, y: 20 }}
          className={cn(
            "p-4 mx-3 mb-4 rounded-xl border",
            contestInfo.premium 
              ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-[0_4px_12px_rgba(245,158,11,0.1)]"
              : "bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-200"
          )}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className={cn(
                "h-5 w-5",
                contestInfo.premium ? "text-amber-600" : "text-amber-500"
              )} />
              <h3 className="font-semibold text-gray-800">Featured Contest</h3>
            </div>
            {contestInfo.premium && (
              <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Premium
              </span>
            )}
          </div>
          
          <p className="text-sm font-medium text-gray-800 mb-1">{contestInfo.title}</p>
          
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <CalendarDays className="h-4 w-4 text-amber-500" />
              <span>Date {new Date(contestInfo.deadline).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Users2 className="h-4 w-4 text-amber-500" />
              <span>{contestInfo.participants.toLocaleString()} participants</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-amber-700">
              <Zap className="h-4 w-4" />
              <span>1st Prize: {contestInfo.prize1}</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-amber-700">
              <Zap className="h-4 w-4" />
              <span>2nd Prize: {contestInfo.prize2}</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-amber-700">
              <Zap className="h-4 w-4" />
              <span>Goodies to Top 15
                {/* {contestInfo.prize} */}
                </span>
            </div>
          </div>

          <Link to="/dashboard/contests">
            <motion.button
              whileHover={{ 
                scale: 1.02,
                boxShadow: contestInfo.premium 
                  ? "0 4px 12px rgba(245, 158, 11, 0.3)"
                  : "0 4px 12px rgba(245, 158, 11, 0.2)"
              }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full mt-3 py-2 text-white rounded-lg transition-all flex items-center justify-center gap-2",
                contestInfo.premium
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-md"
                  : "bg-gradient-to-r from-amber-400 to-amber-500"
              )}
            >
              <Trophy className="h-4 w-4" />
              Register Now
            </motion.button>
          </Link>
        </motion.div>

        {/* Notes Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            transition: { delay: 0.3, type: "spring" }
          }}
          exit={{ opacity: 0, y: 20 }}
          className="p-4 mx-3 mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 shadow-[0_4px_12px_rgba(124,58,237,0.1)]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Notebook className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-800">My Notes</h3>
            </div>
            <div className="flex gap-1">
              {notesSummary.unread > 0 && (
                <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                  {notesSummary.unread} new
                </span>
              )}
              {notesSummary.starred > 0 && (
                <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {notesSummary.starred}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600 mb-3">
            <p>Last updated: <span className="font-medium text-purple-700">{notesSummary.lastUpdated}</span></p>
            <p>Recent subject: <span className="font-medium text-purple-700">{notesSummary.recentSubject}</span></p>
          </div>

          <div className="flex gap-2 mt-4">
            <Link to="/dashboard/notes" className="flex-1">
              <motion.button
                whileHover={{ 
                  scale: 1.02,
                  backgroundColor: "rgba(249, 250, 251, 1)"
                }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2 bg-white border border-purple-200 text-purple-600 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Bookmark className="h-4 w-4" />
                View All
              </motion.button>
            </Link>
            <Link to="/dashboard/notes/new" className="flex-1">
              <motion.button
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)"
                }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                New Note
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
};

export default DashboardSidebar;