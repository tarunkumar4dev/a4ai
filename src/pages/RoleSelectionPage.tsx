// src/pages/RoleSelectionPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { GraduationCap, School, Building2, ArrowRight, LogOut } from "lucide-react";

type Role = "student" | "teacher" | "institute";

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const { session, role: existingRole, updateRole, signOut } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If not logged in, go to login
  if (!session) {
    navigate("/login", { replace: true });
    return null;
  }

  // If role already exists, redirect to dashboard
  if (existingRole) {
    navigate(`/${existingRole}/dashboard`, { replace: true });
    return null;
  }

  const roles = [
    {
      id: "student" as Role,
      title: "Student",
      description: "Access materials, take tests, join contests, track progress",
      icon: GraduationCap,
      gradient: "from-blue-500 to-blue-700",
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
      ring: "ring-blue-300",
    },
    {
      id: "teacher" as Role,
      title: "Teacher",
      description: "Create tests, host contests, manage students, track performance",
      icon: School,
      gradient: "from-purple-500 to-purple-700",
      bg: "bg-purple-50",
      iconColor: "text-purple-600",
      ring: "ring-purple-300",
    },
    {
      id: "institute" as Role,
      title: "Institute",
      description: "Manage teachers, institution analytics, generate reports",
      icon: Building2,
      gradient: "from-green-500 to-green-700",
      bg: "bg-green-50",
      iconColor: "text-green-600",
      ring: "ring-green-300",
    },
  ];

  const handleContinue = async () => {
    if (!selectedRole) return;
    setIsLoading(true);
    try {
      await updateRole(selectedRole);
      toast({ title: "Welcome!", description: `You're all set as a ${selectedRole}.` });
      navigate(`/${selectedRole}/dashboard`, { replace: true });
    } catch (error: any) {
      toast({ title: "Failed to set role", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#E0E6F7] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">One last step</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Welcome, {session.user.user_metadata?.full_name || session.user.email}! Choose your role to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`p-6 rounded-3xl border-2 transition-all duration-200 text-left ${
                selectedRole === r.id
                  ? `border-black bg-white shadow-xl scale-[1.03] ring-4 ${r.ring}`
                  : "border-white/60 bg-white/50 hover:bg-white/80 hover:shadow-md"
              }`}
            >
              <div className={`w-14 h-14 ${r.bg} rounded-2xl flex items-center justify-center mb-4`}>
                <r.icon className={`w-7 h-7 ${r.iconColor}`} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{r.title}</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{r.description}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="h-14 rounded-2xl px-6 font-bold"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!selectedRole || isLoading}
            className="flex-1 h-14 rounded-2xl bg-black text-white font-bold hover:bg-slate-900 disabled:opacity-40"
          >
            {isLoading ? "Setting up..." : "Continue"}
            {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}