// src/components/Navbar.tsx - Ray Monochrome Edition
import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import LanguagePicker from "@/components/LanguagePicker";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
} from "framer-motion";
import { Search, Moon, Sun, Menu, X, ArrowRight } from "lucide-react";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Features", path: "/features" },
  { name: "Pricing", path: "/pricing" },
  { name: "Resources", path: "/resources" },
  { name: "About", path: "/about" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const loggedIn = !!session;

  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { pathname } = useLocation();
  const activeName =
    navItems.find((n) =>
      n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)
    )?.name ?? "Home";

  // subtle cursor glow - now a cool, neutral tone
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const glow = useMotionTemplate`
    radial-gradient(140px 80px at ${mx}px ${my}px, ${isDark ? "rgba(180,180,200,0.1)" : "rgba(60,60,70,0.08)"}, transparent 70%),
    radial-gradient(160px 90px at ${mx}px ${my}px, ${isDark ? "rgba(150,150,180,0.05)" : "rgba(40,40,50,0.05)"}, transparent 75%)
  `;

  // Ray-inspired nav background: sharp gradient from white/grey to black
  const navBg = isDark
    ? "linear-gradient(180deg, #05050a 0%, #000000 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f4f6fa 100%)";

  const navBloom = isDark
    ? "radial-gradient(40rem 18rem at 50% 0%, rgba(150,150,180,0.05) 0%, rgba(100,100,130,0.02) 45%, transparent 70%)"
    : "radial-gradient(40rem 22rem at 50% 0%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 45%, transparent 70%)";

  // Bottom border: very subtle, neutral line
  const borderColor = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.06)";

  // helpers
  const gotoSignIn = () => navigate("/login");
  const gotoSignUp = () => navigate("/signup");
  const gotoDashboard = () => navigate("/dashboard");
  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfileOpen(false);
      setMobileMenuOpen(false);
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/contests")) {
        navigate("/", { replace: true });
      }
    }
  }

  const initials = useMemo(() => {
    const name =
      (session?.user?.user_metadata?.full_name as string | undefined) ||
      (session?.user?.user_metadata?.name as string | undefined) ||
      (session?.user?.email as string | undefined) ||
      "";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
  }, [session]);

  // Nav text colors - high contrast, monochrome
  const activeTextColor = isDark ? "#f0f0fa" : "#101018";
  const mutedTextColor  = isDark ? "#a0a0b0" : "#505060";
  const activeLineBg    = isDark
    ? "linear-gradient(90deg, #a0a0b0, #d0d0e0)"
    : "linear-gradient(90deg, #303038, #707080)";

  return (
    <nav className="sticky top-0 z-50">
      <div
        onMouseMove={onMouseMove}
        className="relative backdrop-blur-xl transition-colors duration-300"
        style={{
          backgroundImage: `${navBloom}, ${navBg}`,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        {/* soft animated glow */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-80 pointer-events-none"
          style={{ backgroundImage: glow }}
        />

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo - refined, monochrome */}
          <Link to="/" className="flex items-center">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2">
              <img src="/ICON.ico" alt="a4ai" className="h-8 w-8" />
              <span
                className="text-xl font-extrabold bg-clip-text text-transparent"
                style={{
                  backgroundImage: isDark
                    ? "linear-gradient(90deg, #e0e0f0 0%, #a0a0c0 50%, #e0e0f0 100%)"
                    : "linear-gradient(90deg, #202028 0%, #505070 50%, #202028 100%)",
                }}
              >
                a4ai
              </span>
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                style={{
                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                  color: isDark ? "#a0a0b0" : "#505060",
                  boxShadow: isDark
                    ? "0 0 0 1px rgba(255,255,255,0.1) inset"
                    : "0 0 0 1px rgba(0,0,0,0.05) inset",
                }}
              >
                βeta 2
              </span>
            </motion.div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center md:flex">
            {navItems.map((item) => {
              const active = activeName === item.name;
              return (
                <Link key={item.name} to={item.path} className="relative px-3 py-2">
                  <motion.span
                    className="text-sm font-medium transition-colors"
                    style={{ color: active ? activeTextColor : mutedTextColor }}
                  >
                    {item.name}
                  </motion.span>

                  <AnimatePresence>
                    {active && (
                      <motion.span
                        layoutId="activeNavLine"
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                        style={{ background: activeLineBg }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* Search */}
            <motion.div className="relative hidden sm:block" whileHover={{ scale: 1.03 }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                style={{ color: mutedTextColor }}
                onClick={() => setSearchOpen((s) => !s)}
                aria-label="Search"
                aria-expanded={searchOpen}
              >
                <Search className="h-5 w-5" />
              </Button>
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 220 }}
                    exit={{ opacity: 0, width: 0 }}
                    className="absolute right-0 top-0 ml-2 h-9 overflow-hidden rounded-full border shadow-sm"
                    style={{
                      background: isDark ? "#000000" : "#ffffff",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search a4ai…"
                      className="h-9 w-full bg-transparent px-3 text-sm outline-none"
                      style={{ color: isDark ? "#f0f0fa" : "#101018" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Language */}
            <div className="hidden sm:block">
              <LanguagePicker />
            </div>

            {/* Theme */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              style={{ color: mutedTextColor }}
              onClick={toggleTheme}
              aria-label="Toggle theme"
              aria-pressed={isDark}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Auth (desktop) */}
            <div className="ml-1 hidden items-center gap-2 md:flex">
              {!loggedIn ? (
                <>
                  <Button
                    variant="ghost"
                    className="h-9 px-3"
                    style={{ color: mutedTextColor }}
                    onClick={gotoSignIn}
                  >
                    Sign in
                  </Button>
                  <Button
                    className="h-9 text-white shadow-sm transition"
                    style={{
                      background: isDark
                        ? "linear-gradient(135deg, #303040 0%, #101018 100%)"
                        : "linear-gradient(135deg, #404050 0%, #202030 100%)",
                      boxShadow: isDark
                        ? "0 4px 14px rgba(0,0,0,0.6)"
                        : "0 4px 14px rgba(0,0,0,0.1)",
                    }}
                    onClick={gotoSignUp}
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="h-9"
                    style={{
                      background: isDark ? "#101018" : "#f0f0f0",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    }}
                    onClick={gotoDashboard}
                  >
                    Dashboard
                  </Button>

                  {/* Profile popover */}
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors"
                      style={{
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                        background: isDark ? "rgba(0,0,0,0.3)" : "transparent",
                        color: isDark ? "#d0d0e0" : "#303038",
                      }}
                      aria-haspopup="menu"
                      aria-expanded={profileOpen}
                    >
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          background: isDark ? "rgba(255,255,255,0.1)" : "#e0e0e0",
                          color: isDark ? "#d0d0e0" : "#303038",
                        }}
                      >
                        {initials}
                      </div>
                      <span className="hidden lg:inline">Profile</span>
                    </button>
                    <AnimatePresence>
                      {profileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute right-0 mt-2 w-44 rounded-xl border p-1 shadow-lg"
                          style={{
                            background: isDark ? "#000000" : "#ffffff",
                            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                            backdropFilter: "blur(16px)",
                          }}
                          onMouseLeave={() => setProfileOpen(false)}
                        >
                          <DropdownItem to="/dashboard/settings" onClick={() => setProfileOpen(false)} isDark={isDark}>
                            Settings
                          </DropdownItem>
                          <DropdownItem to="/dashboard" onClick={() => setProfileOpen(false)} isDark={isDark}>
                            My Dashboard
                          </DropdownItem>
                          <button
                            onClick={handleSignOut}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors"
                            style={{
                              color: isDark ? "#a0a0b0" : "#505060",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            Sign out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Quick CTA */}
            {loggedIn ? (
              <Button
                variant="secondary"
                className="md:hidden h-9 px-3 mr-1"
                style={{
                  background: isDark ? "#101018" : "#f0f0f0",
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                }}
                onClick={() => { setMobileMenuOpen(false); gotoDashboard(); }}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                className="md:hidden h-9 px-3 mr-1 text-white"
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, #303040 0%, #101018 100%)"
                    : "linear-gradient(135deg, #404050 0%, #202030 100%)",
                }}
                onClick={() => { setMobileMenuOpen(false); gotoSignUp(); }}
              >
                Get Started
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 md:hidden"
              style={{ color: mutedTextColor }}
              onClick={() => { setProfileOpen(false); setMobileMenuOpen((m) => !m); }}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="space-y-1 px-2 pt-2 pb-4">
                {navItems.map((item) => {
                  const active = activeName === item.name;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-base font-medium transition-colors"
                      style={{
                        color: active ? activeTextColor : mutedTextColor,
                        background: active
                          ? isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)"
                          : "transparent",
                      }}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                <div className="mt-3">
                  <div className="mb-2">
                    <LanguagePicker />
                  </div>

                  {!loggedIn ? (
                    <>
                      <Button
                        variant="outline"
                        className="mb-2 w-full"
                        style={{
                          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                          color: isDark ? "#d0d0e0" : "#303038",
                        }}
                        onClick={() => { setMobileMenuOpen(false); gotoSignIn(); }}
                      >
                        Sign in
                      </Button>
                      <Button
                        className="w-full text-white"
                        style={{
                          background: isDark
                            ? "linear-gradient(135deg, #303040 0%, #101018 100%)"
                            : "linear-gradient(135deg, #404050 0%, #202030 100%)",
                        }}
                        onClick={() => { setMobileMenuOpen(false); gotoSignUp(); }}
                      >
                        Get Started
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        className="mb-2 w-full"
                        style={{
                          background: isDark ? "#101018" : "#f0f0f0",
                          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                        }}
                        onClick={() => { setMobileMenuOpen(false); gotoDashboard(); }}
                      >
                        Dashboard
                      </Button>
                      <Button
                        className="w-full"
                        style={{
                          background: isDark ? "#202028" : "#e0e0e0",
                          color: isDark ? "#f0f0fa" : "#101018",
                        }}
                        onClick={handleSignOut}
                      >
                        Sign out
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

function DropdownItem({
  to,
  children,
  onClick,
  isDark,
}: {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
  isDark: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm transition-colors"
      style={{ color: isDark ? "#d0d0e0" : "#303038" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </Link>
  );
}