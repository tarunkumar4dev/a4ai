import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileText,
  BarChart2,
  Users,
  CreditCard,
  Settings,
  LayoutDashboard,
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, isActive }: SidebarItemProps) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    transition={{ type: "spring", stiffness: 300 }}
  >
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-300",
        isActive
          ? "bg-zolvio-purple text-white shadow-md"
          : "text-gray-600 hover:bg-zolvio-light-bg hover:text-zolvio-purple"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-md font-medium">{label}</span>
    </Link>
  </motion.div>
);

const DashboardSidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: FileText, label: "Test Generator", href: "/dashboard/test-generator" },
    { icon: BarChart2, label: "Analytics", href: "/dashboard/analytics" },
    { icon: Users, label: "Students", href: "/dashboard/students" },
    { icon: CreditCard, label: "Subscription", href: "/dashboard/subscription" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  ];

  const planInfo = {
    plan: "Free Plan",
    usage: "7/10 tests remaining this month",
    progress: 70,
  };

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="w-64 border-r bg-white flex flex-col h-screen shadow-md"
    >
      <div className="p-6">
        <Link to="/" className="text-2xl font-bold text-zolvio-purple tracking-tight">
          Zolvio.ai
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {sidebarItems.map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            isActive={currentPath === item.href}
          />
        ))}
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 mx-3 mb-6 bg-zolvio-light-bg rounded-xl shadow-inner"
      >
        <h3 className="font-semibold text-lg">{planInfo.plan}</h3>
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-2 bg-zolvio-purple rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${planInfo.progress}%` }}
            transition={{ duration: 1 }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">{planInfo.usage}</p>
        <Link to="/dashboard/subscription">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full mt-3 py-2 bg-zolvio-purple hover:bg-zolvio-purple-hover text-white rounded-md transition-all"
          >
            Upgrade to Premium
          </motion.button>
        </Link>
      </motion.div>
    </motion.aside>
  );
};

export default DashboardSidebar;
