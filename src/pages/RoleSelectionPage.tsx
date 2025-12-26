// src/pages/RoleSelectionPage.tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, School, Building2, ArrowRight } from "lucide-react";

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher" | "institute" | null>(null);
  
  // Get the auth type from location state
  const authType = location.state?.type || "signup"; // "signup" or "login"
  const email = location.state?.email || "";

  const roles = [
    {
      id: "student",
      title: "Student",
      description: "Access learning materials, take tests, join contests, and track your progress",
      icon: GraduationCap,
      color: "from-blue-500 to-blue-700",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600"
    },
    {
      id: "teacher",
      title: "Teacher",
      description: "Create tests, host contests, manage students, and track class performance",
      icon: School,
      color: "from-purple-500 to-purple-700",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600"
    },
    {
      id: "institute",
      title: "Institute",
      description: "Manage multiple teachers, track institution performance, and generate reports",
      icon: Building2,
      color: "from-green-500 to-green-700",
      bgColor: "bg-green-50",
      iconColor: "text-green-600"
    }
  ];

  const handleContinue = () => {
    if (!selectedRole) return;
    
    if (authType === "signup") {
      // Navigate to signup page with selected role
      navigate("/signup", { 
        state: { 
          role: selectedRole,
          email: email
        }
      });
    } else {
      // Navigate to login page with selected role
      navigate("/login", { 
        state: { 
          role: selectedRole,
          email: email
        }
      });
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold text-gray-900">
            {authType === "signup" ? "Join as..." : "Login as..."}
          </CardTitle>
          <CardDescription className="text-lg text-gray-600">
            Select your role to continue {authType === "signup" ? "signing up" : "logging in"}
          </CardDescription>
          {email && (
            <div className="mt-2 p-3 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-700">
                Continuing with: <span className="font-semibold">{email}</span>
              </p>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Card 
                key={role.id}
                className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border-2 ${
                  selectedRole === role.id 
                    ? `border-blue-500 ring-2 ring-blue-200` 
                    : 'border-gray-200'
                }`}
                onClick={() => setSelectedRole(role.id as "student" | "teacher" | "institute")}
              >
                <CardHeader className="pb-2">
                  <div className={`w-16 h-16 ${role.bgColor} rounded-full flex items-center justify-center mb-4 mx-auto`}>
                    <role.icon className={`h-8 w-8 ${role.iconColor}`} />
                  </div>
                  <CardTitle className="text-xl text-center text-gray-900">{role.title}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-gray-600 text-center text-sm leading-relaxed">
                    {role.description}
                  </p>
                </CardContent>
                <CardFooter className="pt-0 justify-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedRole === role.id 
                      ? `bg-gradient-to-r ${role.color} text-white` 
                      : 'bg-gray-200'
                  }`}>
                    {selectedRole === role.id && (
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 border-t pt-6">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
            >
              Go Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!selectedRole}
              className={`flex-1 bg-gradient-to-r ${
                selectedRole === 'student' ? 'from-blue-600 to-blue-700' :
                selectedRole === 'teacher' ? 'from-purple-600 to-purple-700' :
                'from-green-600 to-green-700'
              } hover:opacity-90 text-white`}
            >
              Continue {authType === "signup" ? "Sign Up" : "Login"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-gray-500 text-center">
            {authType === "signup" 
              ? "Already have an account? " 
              : "Don't have an account? "}
            <Button 
              variant="link" 
              className="p-0 h-auto"
              onClick={() => navigate(authType === "signup" ? "/login" : "/signup")}
            >
              {authType === "signup" ? "Login here" : "Sign up here"}
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}