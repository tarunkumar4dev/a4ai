// Navbar.tsx — Heavy Apple glass, opaque grey glossy buttons
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import LanguagePicker from "@/components/LanguagePicker";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { Search, Moon, Sun, Menu, X, ArrowRight, User } from "lucide-react";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Features", path: "/features" },
  { name: "Pricing", path: "/pricing" },
  { name: "Resources", path: "/resources" },
  { name: "About", path: "/about" },
];

// New Brand Gradient: Green -> Teal -> Blue -> Purple
const BRAND_GRADIENT = "linear-gradient(90deg, #4ade80, #2dd4bf, #60a5fa, #818cf8, #4ade80, #2dd4bf, #60a5fa, #818cf8)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

export default function Navbar() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const loggedIn = !!session;
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { pathname } = useLocation();
  const activeName = navItems.find(n => n.path === "/" ? pathname === "/" : pathname.startsWith(n.path))?.name ?? "Home";

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left); my.set(e.clientY - r.top);
  };
  const glow = useMotionTemplate`radial-gradient(180px 80px at ${mx}px ${my}px, ${isDark ? "rgba(45,212,191,0.07)" : "rgba(45,212,191,0.04)"}, transparent 70%)`;

  const gotoSignIn = () => navigate("/login");
  const gotoSignUp = () => navigate("/signup");
  const gotoDashboard = () => navigate("/dashboard");

  async function handleSignOut() {
    try { await supabase.auth.signOut(); }
    finally {
      setProfileOpen(false); setMobileMenuOpen(false);
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/contests"))
        navigate("/", { replace: true });
    }
  }

  const mutedColor = isDark ? "#8a9bb0" : "#5f6368";
  const activeColor = isDark ? "#2dd4bf" : "#0d9488";
  const textColor = isDark ? "#e8eaed" : "#202124";

  // Apple-grade glass styles
  const navGlass = isDark
    ? {
      background: "rgba(10,12,20,0.72)",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(40px) saturate(200%)",
      WebkitBackdropFilter: "blur(40px) saturate(200%)",
      boxShadow: "0 1px 0 rgba(255,255,255,0.06), 0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
    }
    : {
      background: "rgba(255,255,255,0.78)",
      borderBottom: "1px solid rgba(0,0,0,0.08)",
      backdropFilter: "blur(40px) saturate(200%)",
      WebkitBackdropFilter: "blur(40px) saturate(200%)",
      boxShadow: "0 1px 0 rgba(255,255,255,1), 0 4px 32px rgba(45,212,191,0.05), 0 1px 12px rgba(0,0,0,0.06)",
    };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <style>{`
        @keyframes fast-gradient {
          0% { background-position: 0% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
      <div onMouseMove={onMouseMove} className="relative transition-all duration-300" style={navGlass}>

        {/* Top spectral edge line matched to brand colors */}
        <div aria-hidden className="absolute top-0 left-0 right-0 h-px"
          style={{ background: isDark ? "linear-gradient(90deg,transparent 5%,rgba(74,222,128,0.4) 30%,rgba(129,140,248,0.4) 70%,transparent 95%)" : "linear-gradient(90deg,transparent 5%,rgba(74,222,128,0.2) 30%,rgba(129,140,248,0.2) 70%,transparent 95%)" }} />

        {/* Cursor glow */}
        <motion.div aria-hidden className="absolute inset-0 -z-10 pointer-events-none" style={{ backgroundImage: glow }} />

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2">
              <img src="/ICON.ico" alt="a4ai" className="h-8 w-8" />
              <span className="text-xl font-extrabold" style={{ color: isDark ? "#f1f5f9" : "#111111" }}>a4ai</span>
              <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: isDark ? "rgba(45,212,191,0.12)" : "rgba(45,212,191,0.07)",
                  color: isDark ? "#2dd4bf" : "#0d9488",
                  border: isDark ? "1px solid rgba(45,212,191,0.2)" : "1px solid rgba(45,212,191,0.12)",
                }}>βeta 2</span>
            </motion.div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center md:flex">
            {navItems.map(item => {
              const active = activeName === item.name;
              return (
                <Link key={item.name} to={item.path} className="relative px-3.5 py-2">
                  <span className="text-sm font-medium transition-colors duration-200"
                    style={{ color: active ? activeColor : mutedColor }}>
                    {item.name}
                  </span>
                  <AnimatePresence>
                    {active && (
                      <motion.span layoutId="navLine"
                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                        style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">

            {/* Search */}
            <div className="hidden sm:flex items-center">
              <AnimatePresence mode="wait">
                {searchOpen ? (
                  <motion.div key="open"
                    initial={{ opacity: 0, width: 36 }} animate={{ opacity: 1, width: 220 }} exit={{ opacity: 0, width: 36 }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    className="flex items-center rounded-full h-9 overflow-hidden"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.9)",
                      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.09)",
                      backdropFilter: "blur(32px) saturate(180%)",
                      WebkitBackdropFilter: "blur(32px) saturate(180%)",
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 16px rgba(0,0,0,0.4)"
                        : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 12px rgba(0,0,0,0.08)",
                    }}>
                    <Search className="h-4 w-4 ml-3 flex-shrink-0" style={{ color: isDark ? "#2dd4bf" : "#0d9488" }} />
                    <input autoFocus type="text" value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Escape" && (setSearchOpen(false), setSearchQuery(""))}
                      placeholder="Search a4ai…"
                      className="flex-1 h-full bg-transparent px-2 text-sm outline-none min-w-0"
                      style={{ color: isDark ? "#e8eaed" : "#202124" }} />
                    <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                      className="mr-2.5 flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                      style={{ color: mutedColor }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.button key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setSearchOpen(true)}
                    className="h-9 w-9 flex items-center justify-center rounded-full transition-all hover:scale-105"
                    style={{ color: mutedColor }} aria-label="Search">
                    <Search className="h-4.5 w-4.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Language */}
            <div className="hidden sm:block"><LanguagePicker /></div>

            {/* Theme */}
            <button onClick={toggleTheme}
              className="h-9 w-9 flex items-center justify-center rounded-full transition-all hover:scale-105"
              style={{ color: mutedColor }} aria-label="Toggle theme">
              {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>

            {/* Auth desktop */}
            <div className="ml-2 hidden items-center gap-2 md:flex">
              {!loggedIn ? (
                <>
                  <button onClick={gotoSignIn}
                    className="h-9 px-4 text-sm font-medium rounded-full transition-colors"
                    style={{ color: mutedColor }}>
                    Sign in
                  </button>

                  {/* Black glossy button */}
                  <button onClick={gotoSignUp}
                    className="relative h-[38px] px-5 rounded-full text-sm font-semibold text-white flex items-center gap-1.5 overflow-hidden transition-all duration-200 hover:-translate-y-[1px]"
                    style={{
                      background: isDark ? "linear-gradient(180deg,#1c2333 0%,#0d1117 100%)" : "linear-gradient(180deg,#202124 0%,#111 100%)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.16)", "inset 0 -1px 0 rgba(0,0,0,0.3)", "0 1px 3px rgba(0,0,0,0.4)", "0 6px 20px rgba(0,0,0,0.3)"].join(", "),
                    }}>
                    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
                      style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 100%)" }} />
                    <span className="relative z-10">Get Started</span>
                    <ArrowRight className="h-3.5 w-3.5 relative z-10" />
                  </button>
                </>
              ) : (
                <>
                  {/* macOS Opaque Glossy Dashboard button */}
                  <button onClick={gotoDashboard}
                    className="h-[38px] px-4 rounded-full text-sm font-medium overflow-hidden relative transition-all duration-200 hover:-translate-y-[1px]"
                    style={{
                      background: isDark ? "rgba(60,60,65,0.7)" : "rgba(235,235,240,0.85)",
                      border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.12)",
                      backdropFilter: "blur(28px) saturate(180%)",
                      WebkitBackdropFilter: "blur(28px) saturate(180%)",
                      color: textColor,
                      boxShadow: isDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4)"
                        : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 10px rgba(0,0,0,0.07)",
                    }}>
                    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                      style={{ background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%)" }} />
                    <span className="relative z-10">Dashboard</span>
                  </button>

                  {/* Profile Button - macOS Opaque Glossy */}
                  <div className="relative">
                    <button onClick={() => setProfileOpen(v => !v)}
                      className="relative inline-flex items-center gap-2 rounded-full px-3 py-[7px] text-sm overflow-hidden transition-all duration-200 hover:-translate-y-[1px]"
                      style={{
                        background: isDark ? "rgba(60,60,65,0.7)" : "rgba(235,235,240,0.85)",
                        border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.12)",
                        backdropFilter: "blur(28px) saturate(180%)",
                        WebkitBackdropFilter: "blur(28px) saturate(180%)",
                        color: textColor,
                        boxShadow: isDark
                          ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.4)"
                          : "inset 0 1px 0 rgba(255,255,255,1), 0 2px 10px rgba(0,0,0,0.07)",
                      }}>
                      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                        style={{ background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%)" }} />

                      {/* Generic Face Icon for Profile */}
                      <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)" }}>
                        <User className="h-3.5 w-3.5" style={{ color: textColor }} />
                      </div>
                      <span className="hidden lg:inline relative z-10">Profile</span>
                    </button>

                    <AnimatePresence>
                      {profileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96 }}
                          transition={{ type: "spring", stiffness: 320, damping: 28 }}
                          className="absolute right-0 mt-2 w-44 rounded-2xl p-1.5"
                          style={{
                            background: isDark ? "rgba(10,12,20,0.88)" : "rgba(255,255,255,0.92)",
                            border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
                            backdropFilter: "blur(48px) saturate(200%)",
                            WebkitBackdropFilter: "blur(48px) saturate(200%)",
                            boxShadow: isDark
                              ? "0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)"
                              : "0 24px 64px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)",
                          }}
                          onMouseLeave={() => setProfileOpen(false)}>
                          <DropItem to="/dashboard/settings" onClick={() => setProfileOpen(false)} isDark={isDark}>Settings</DropItem>
                          <DropItem to="/dashboard" onClick={() => setProfileOpen(false)} isDark={isDark}>My Dashboard</DropItem>
                          <button onClick={handleSignOut}
                            className="w-full text-left rounded-xl px-3 py-2 text-sm transition-colors"
                            style={{ color: mutedColor }}
                            onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            Sign out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>

            {/* Mobile CTA */}
            {loggedIn ? (
              <button className="md:hidden relative h-9 px-3 mr-1 rounded-full text-sm overflow-hidden"
                style={{
                  background: isDark ? "rgba(60,60,65,0.7)" : "rgba(235,235,240,0.85)",
                  border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.12)",
                  backdropFilter: "blur(28px)",
                  color: textColor,
                  boxShadow: isDark ? "inset 0 1px 0 rgba(255,255,255,0.1)" : "inset 0 1px 0 rgba(255,255,255,1)",
                }}
                onClick={() => { setMobileMenuOpen(false); gotoDashboard(); }}>
                Dashboard
              </button>
            ) : (
              <button className="md:hidden relative h-9 px-4 mr-1 rounded-full text-sm font-semibold text-white overflow-hidden"
                style={{
                  background: "linear-gradient(180deg,#202124 0%,#111 100%)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 14px rgba(0,0,0,0.35)",
                }}
                onClick={() => { setMobileMenuOpen(false); gotoSignUp(); }}>
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                  style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 100%)" }} />
                <span className="relative z-10">Get Started</span>
              </button>
            )}

            <button className="ml-1 md:hidden h-9 w-9 flex items-center justify-center rounded-full"
              style={{ color: mutedColor }}
              onClick={() => { setProfileOpen(false); setMobileMenuOpen(m => !m); }}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
              style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.05)" }}>
              <div className="space-y-1 px-3 pt-2 pb-5">
                {navItems.map(item => {
                  const active = activeName === item.name;
                  return (
                    <Link key={item.name} to={item.path} onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-base font-medium transition-colors"
                      style={{
                        color: active ? activeColor : mutedColor,
                        background: active ? isDark ? "rgba(45,212,191,0.08)" : "rgba(45,212,191,0.05)" : "transparent",
                      }}>
                      {item.name}
                    </Link>
                  );
                })}
                <div className="pt-2 space-y-2">
                  <LanguagePicker />
                  {!loggedIn ? (
                    <>
                      <button className="w-full h-10 rounded-xl text-sm font-medium border transition-colors"
                        style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", color: textColor, background: "transparent" }}
                        onClick={() => { setMobileMenuOpen(false); gotoSignIn(); }}>
                        Sign in
                      </button>
                      <button className="relative w-full h-10 rounded-xl text-sm font-semibold text-white overflow-hidden"
                        style={{ background: "linear-gradient(180deg,#202124 0%,#111 100%)", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)" }}
                        onClick={() => { setMobileMenuOpen(false); gotoSignUp(); }}>
                        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                          style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.16) 0%,transparent 100%)" }} />
                        <span className="relative z-10">Get Started</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="relative w-full h-10 rounded-xl text-sm overflow-hidden"
                        style={{ background: isDark ? "rgba(60,60,65,0.7)" : "rgba(235,235,240,0.85)", border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.12)", color: textColor, backdropFilter: "blur(20px)" }}
                        onClick={() => { setMobileMenuOpen(false); gotoDashboard(); }}>
                        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                          style={{ background: isDark ? "linear-gradient(180deg,rgba(255,255,255,0.1) 0%,transparent 100%)" : "linear-gradient(180deg,rgba(255,255,255,0.8) 0%,transparent 100%)" }} />
                        <span className="relative z-10">Dashboard</span>
                      </button>
                      <button className="w-full h-10 rounded-xl text-sm transition-colors" style={{ color: mutedColor }} onClick={handleSignOut}>
                        Sign out
                      </button>
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

function DropItem({ to, children, onClick, isDark }: { to: string; children: React.ReactNode; onClick?: () => void; isDark: boolean }) {
  return (
    <Link to={to} onClick={onClick}
      className="block rounded-xl px-3 py-2 text-sm transition-colors"
      style={{ color: isDark ? "#c8d4e0" : "#202124" }}
      onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      {children}
    </Link>
  );
}