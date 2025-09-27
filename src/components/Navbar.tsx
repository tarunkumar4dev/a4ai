// src/components/Navbar.tsx
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
import { Search, Moon, Sun, Menu, X, ArrowRight, User } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { pathname } = useLocation();
  const activeName =
    navItems.find((n) =>
      n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)
    )?.name ?? "Home";

  // subtle cursor glow
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const glow = useMotionTemplate`
    radial-gradient(140px 80px at ${mx}px ${my}px, rgba(93,107,123,0.10), transparent 70%),
    radial-gradient(160px 90px at ${mx}px ${my}px, rgba(175,186,199,0.08), transparent 75%)
  `;

  // hero-matching background
  const heroBase = "linear-gradient(140deg, #F6F9FF 0%, #E9EEF7 48%, #DCE3ED 100%)";
  const heroBloom =
    "radial-gradient(40rem 22rem at 50% 0%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 70%)";

  // auth helpers
  const gotoSignIn = () => navigate("/login");
  const gotoSignUp = () => navigate("/signup");
  const gotoDashboard = () => navigate("/dashboard");

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfileOpen(false);
      setMobileMenuOpen(false);
      // if currently on protected area, send home
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/contests")) {
        navigate("/", { replace: true });
      }
    }
  }

  // derive user initials for circle avatar (optional)
  const initials = useMemo(() => {
    const name =
      (session?.user?.user_metadata?.full_name as string | undefined) ||
      (session?.user?.user_metadata?.name as string | undefined) ||
      (session?.user?.email as string | undefined) ||
      "";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
  }, [session]);

  return (
    <nav className="sticky top-0 z-50">
      <div
        onMouseMove={onMouseMove}
        className="relative backdrop-blur-xl"
        style={{ backgroundImage: `${heroBloom}, ${heroBase}` }}
      >
        {/* soft animated glow */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-80 pointer-events-none"
          style={{ backgroundImage: glow }}
        />

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2">
              <img src="/ICON.ico" alt="a4ai" className="h-8 w-8" />
              <span
                className="text-xl font-extrabold bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #2F3A44 0%, #5F7388 50%, #2F3A44 100%)",
                }}
              >
                a4ai
              </span>
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.75)",
                  color: "#4E5A66",
                  boxShadow: "0 0 0 1px rgba(228,233,240,0.9) inset",
                }}
              >
                βeta
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
                    style={{ color: active ? "#2F3A44" : "#5D6B7B" }}
                  >
                    {item.name}
                  </motion.span>

                  <AnimatePresence>
                    {active && (
                      <motion.span
                        layoutId="activeNavLine"
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                        style={{ background: "linear-gradient(90deg, #5D6B7B, #AFBAC7)" }}
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
                style={{ color: "#5D6B7B" }}
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
                    className="absolute right-0 top-0 ml-2 h-9 overflow-hidden rounded-full border bg-white shadow-sm dark:bg-gray-900"
                    style={{ borderColor: "rgba(228,233,240,0.9)" }}
                  >
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search a4ai…"
                      className="h-9 w-full bg-transparent px-3 text-sm text-gray-900 outline-none dark:text-white"
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
              style={{ color: "#5D6B7B" }}
              onClick={toggleTheme}
              aria-label="Toggle theme"
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Auth (desktop) */}
            <div className="ml-1 hidden items-center gap-2 md:flex">
              {!loggedIn ? (
                <>
                  <Button variant="ghost" className="h-9 px-3" style={{ color: "#5D6B7B" }} onClick={gotoSignIn}>
                    Sign in
                  </Button>
                  <Button className="h-9 text-white shadow-sm transition" style={{ background: "#5D6B7B" }} onClick={gotoSignUp}>
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" className="h-9" onClick={gotoDashboard}>
                    Dashboard
                  </Button>

                  {/* Profile dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      aria-haspopup="menu"
                      aria-expanded={profileOpen}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700">
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
                          className="absolute right-0 mt-2 w-44 rounded-xl border bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
                          onMouseLeave={() => setProfileOpen(false)}
                        >
                          <DropdownItem to="/dashboard/settings" onClick={() => setProfileOpen(false)}>
                            Settings
                          </DropdownItem>
                          <DropdownItem to="/dashboard" onClick={() => setProfileOpen(false)}>
                            My Dashboard
                          </DropdownItem>
                          <button
                            onClick={handleSignOut}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
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

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 md:hidden"
              style={{ color: "#5D6B7B" }}
              onClick={() => {
                setProfileOpen(false);
                setMobileMenuOpen((m) => !m);
              }}
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
                        color: active ? "#2F3A44" : "#5D6B7B",
                        background: active ? "rgba(223,228,239,0.8)" : "transparent",
                      }}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                {/* Mobile controls */}
                <div className="mt-3">
                  <div className="mb-2">
                    <LanguagePicker />
                  </div>

                  {!loggedIn ? (
                    <>
                      <Button
                        variant="outline"
                        className="mb-2 w-full"
                        style={{ borderColor: "rgba(228,233,240,0.9)" }}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          gotoSignIn();
                        }}
                      >
                        Sign in
                      </Button>
                      <Button
                        className="w-full text-white"
                        style={{ background: "#5D6B7B" }}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          gotoSignUp();
                        }}
                      >
                        Get Started
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        className="mb-2 w-full"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          gotoDashboard();
                        }}
                      >
                        Dashboard
                      </Button>
                      <Button
                        className="w-full"
                        onClick={() => {
                          handleSignOut();
                        }}
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
}: {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      {children}
    </Link>
  );
}
