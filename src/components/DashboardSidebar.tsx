
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  BarChart2, 
  Users, 
  CreditCard, 
  Settings,
  LayoutDashboard 
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, isActive }: SidebarItemProps) => (
  <Link
    to={href}
    className={cn(
      "flex items-center py-3 px-4 rounded-md transition-colors",
      isActive 
        ? "bg-zolvio-purple text-white" 
        : "text-gray-600 hover:bg-zolvio-light-bg hover:text-zolvio-purple"
    )}
  >
    <Icon className="h-5 w-5 mr-3" />
    <span>{label}</span>
  </Link>
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
    progress: 70, // percentage of usage
  };

  return (
    <aside className="w-64 border-r bg-white flex flex-col h-screen">
      <div className="p-6">
        <Link to="/" className="text-xl font-bold logo">Zolvio.ai</Link>
      </div>
      <nav className="flex-1 px-3 py-2">
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
      <div className="p-4 mx-3 mb-6 bg-zolvio-light-bg rounded-lg">
        <h3 className="font-semibold text-lg">{planInfo.plan}</h3>
        <div className="mt-2 h-2 bg-gray-200 rounded-full">
          <div 
            className="h-2 bg-zolvio-purple rounded-full" 
            style={{ width: `${planInfo.progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">{planInfo.usage}</p>
        <Link to="/dashboard/subscription">
          <button className="w-full mt-3 py-2 bg-zolvio-purple hover:bg-zolvio-purple-hover text-white rounded-md transition-colors">
            Upgrade to Premium
          </button>
        </Link>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
