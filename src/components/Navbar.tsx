// Navbar.tsx — Clean White Frosted Glass Floating Dock with Embedded Search & Interactivity
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LanguagePicker from "@/components/LanguagePicker";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate, type Variants } from "framer-motion";
import { Search, Menu, X, ArrowRight, User, Settings, LayoutDashboard, LogOut, ChevronRight } from "lucide-react";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Features", path: "/features" },
  { name: "Pricing", path: "/pricing" },
  { name: "Resources", path: "/resources" },
  { name: "About", path: "/about" },
];

const BRAND_GRADIENT =
  "linear-gradient(90deg, #34d399, #22d3ee, #818cf8, #c084fc, #34d399, #22d3ee, #818cf8, #c084fc)";
const gradientAnimStyle = { backgroundSize: "200% auto", animation: "fast-gradient 4s linear infinite" };

interface SuggestionItem {
  name: string;
  path: string;
  subOptions?: { name: string; path: string; icon: any }[];
}

const dockContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const dockItem: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.88 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 170, damping: 16, mass: 0.5 },
  },
};

export default function Navbar() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const loggedIn = !!session;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const { pathname } = useLocation();
  const activeName =
    navItems.find((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)))?.name ?? "Home";

  // Defined custom search schema with explicit structural profile sub-options
  const searchSuggestions: SuggestionItem[] = useMemo(() => [
    { name: "Dashboard", path: "/dashboard" },
    { 
      name: "Profile", 
      path: "/profile",
      subOptions: [
        { name: "Settings", path: "/dashboard/settings", icon: Settings },
        { name: "My Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { name: "Sign out", path: "/logout", icon: LogOut }
      ]
    },
    { name: "Pricing", path: "/pricing" },
    { name: "Features", path: "/features" },
    { name: "Resources", path: "/resources" },
    { name: "About", path: "/about" },
  ], []);

  const filteredSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return searchSuggestions;
    return searchSuggestions.filter(
      (s) => 
        s.name.toLowerCase().includes(q) || 
        (s.subOptions && s.subOptions.some(sub => sub.name.toLowerCase().includes(q)))
    );
  }, [searchQuery, searchSuggestions]);

  const handleSearchSelect = useCallback(
    (path: string) => {
      setSearchOpen(false);
      setSearchQuery("");
      setMobileMenuOpen(false);
      if (path === "/logout") {
        handleSignOut();
      } else {
        navigate(path);
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const glow = useMotionTemplate`radial-gradient(180px 80px at ${mx}px ${my}px, rgba(16,185,129,0.05), transparent 70%)`;

  const gotoSignIn = () => navigate("/login");
  const gotoSignUp = () => navigate("/signup");
  const gotoDashboard = () => navigate("/dashboard");

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfileOpen(false);
      setMobileMenuOpen(false);
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/contests"))
        navigate("/", { replace: true });
    }
  }

  const mutedColor = "#5f6368";
  const activeColor = "#047857";
  const textColor = "#202124";

  return (
    <>
      <style>{`
        @keyframes fast-gradient {
          0% { background-position: 0% center; }
          100% { background-position: -200% center; }
        }
        
        .force-light-dock {
          background-color: rgba(255, 255, 255, 0.45) !important;
          background: rgba(255, 255, 255, 0.45) !important;
          backdrop-filter: blur(24px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
          border: 1px solid rgba(255, 255, 255, 0.5) !important;
          color-scheme: light only !important;
          forced-color-adjust: none !important;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6), 0 8px 32px rgba(0, 0, 0, 0.03) !important;
        }

        .immutable-dark-btn {
          background: linear-gradient(180deg, #252629 0%, #0d0d0e 100%) !important;
          background-color: #0d0d0e !important;
          color: #ffffff !important;
          fill: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          color-scheme: light only !important;
          forced-color-adjust: none !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.3) !important;
        }

        .immutable-dark-btn * {
          color: #ffffff !important;
          stroke: #ffffff !important;
        }

        .mobile-toggle-trigger {
          position: relative !important;
          z-index: 9999 !important;
          pointer-events: auto !important;
          touch-action: manipulation !important;
          -webkit-tap-highlight-color: transparent !important;
        }
      `}</style>

      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 pt-2.5 sm:px-4 sm:pt-3">
        <div
          onMouseMove={onMouseMove}
          className="relative w-full max-w-[1200px] transition-all duration-300 force-light-dock"
          style={{ borderRadius: 22 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 -z-10 pointer-events-none"
            style={{ backgroundImage: glow, borderRadius: "inherit" }}
          />

          <motion.div
            variants={dockContainer}
            initial="hidden"
            animate="show"
            className="flex h-14 sm:h-[58px] items-center justify-between px-4 sm:px-5"
          >
            {/* Logo */}
            <motion.div variants={dockItem}>
              <Link to="/" className="flex items-center flex-shrink-0">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-2">
                  <img src="/ICON.ico" alt="a4ai" className="h-7 w-7 sm:h-8 sm:w-8" />
                  <span className="text-lg sm:text-xl font-extrabold text-neutral-900">
                    a4ai
                  </span>
                </motion.div>
              </Link>
            </motion.div>

            {/* Desktop Links */}
            <motion.div variants={dockContainer} className="hidden items-center md:flex">
              {navItems.map((item) => {
                const active = activeName === item.name;
                return (
                  <motion.div key={item.name} variants={dockItem}>
                    <Link to={item.path} className="relative px-3 py-2">
                      <span
                        className="text-sm font-medium transition-colors duration-200"
                        style={{ color: active ? activeColor : mutedColor }}
                      >
                        {item.name}
                      </span>
                      <AnimatePresence>
                        {active && (
                          <motion.span
                            layoutId="navLine"
                            className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                            style={{ background: BRAND_GRADIENT, ...gradientAnimStyle }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </AnimatePresence>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Actions Panel */}
            <motion.div variants={dockItem} className="flex items-center gap-2 justify-end flex-1 md:flex-none">
              
              {/* Contextual Search Dropdown module (Always visible on mobile & desktop) */}
              <div className="relative flex items-center" ref={searchRef}>
                <AnimatePresence mode="wait">
                  {searchOpen ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0, width: 36 }}
                      animate={{ opacity: 1, width: window.innerWidth < 640 ? 160 : 240 }}
                      exit={{ opacity: 0, width: 36 }}
                      className="flex items-center rounded-full h-9 overflow-visible bg-white border border-neutral-300 shadow-sm backdrop-blur-md"
                    >
                      <Search className="h-4 w-4 ml-3 flex-shrink-0" style={{ color: activeColor }} />
                      <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="flex-1 h-full bg-transparent px-2 text-sm outline-none min-w-0"
                        style={{ color: textColor }}
                      />
                      <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="mr-2.5 flex-shrink-0 opacity-40">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button onClick={() => setSearchOpen(true)} className="h-9 w-9 flex items-center justify-center rounded-full border border-neutral-200 bg-white/80 shadow-sm md:border-transparent md:bg-transparent" style={{ color: mutedColor }}>
                      <Search className="h-4 w-4" />
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Inline Suggestions dropdown underneath without full-cover blocks */}
                {searchOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl ring-1 ring-black ring-opacity-5 z-[9999]">
                    <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Suggestions
                    </div>
                    <div className="mt-1 space-y-0.5 max-h-[280px] overflow-y-auto">
                      {filteredSuggestions.map((item) => (
                        <div key={item.name} className="block">
                          <button
                            onClick={() => handleSearchSelect(item.path)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-emerald-600 transition-colors"
                          >
                            <span>{item.name}</span>
                            {!item.subOptions && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
                          </button>
                          
                          {item.subOptions && (
                            <div className="ml-3 mt-0.5 border-l border-neutral-100 pl-2 space-y-0.5">
                              {item.subOptions.map((sub) => {
                                const SubIcon = sub.icon;
                                return (
                                  <button
                                    key={sub.name}
                                    onClick={() => handleSearchSelect(sub.path)}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                                  >
                                    <SubIcon className="h-3.5 w-3.5 opacity-60" />
                                    <span>{sub.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden sm:block">
                <LanguagePicker />
              </div>

              <div className="hidden items-center gap-1.5 md:flex">
                {!loggedIn ? (
                  <>
                    <button onClick={gotoSignIn} className="h-9 px-3.5 text-sm font-medium rounded-full" style={{ color: mutedColor }}>
                      Sign in
                    </button>

                    <button
                      onClick={gotoSignUp}
                      className="relative h-[36px] px-4.5 rounded-full text-sm font-semibold flex items-center gap-1.5 overflow-hidden transition-transform duration-200 active:scale-95 immutable-dark-btn"
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/15 to-transparent" />
                      <span className="relative z-10">Get Started</span>
                      <ArrowRight className="h-3.5 w-3.5 relative z-10" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={gotoDashboard} className="h-[36px] px-3.5 rounded-full text-sm font-medium bg-white border border-neutral-300 text-neutral-800 shadow-sm">
                      Dashboard
                    </button>

                    <div className="relative">
                      <button onClick={() => setProfileOpen((v) => !v)} className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-[6px] text-sm bg-white border border-neutral-300 text-neutral-800 shadow-sm">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5">
                          <User className="h-3.5 w-3.5" style={{ color: textColor }} />
                        </div>
                        <span className="hidden lg:inline relative z-10">Profile</span>
                      </button>

                      <AnimatePresence>
                        {profileOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute right-0 mt-2 w-44 rounded-2xl p-1.5 bg-white border border-neutral-200 shadow-xl"
                            onMouseLeave={() => setProfileOpen(false)}
                          >
                            <DropItem to="/dashboard/settings" onClick={() => setProfileOpen(false)}>Settings</DropItem>
                            <DropItem to="/dashboard" onClick={() => setProfileOpen(false)}>My Dashboard</DropItem>
                            <button onClick={handleSignOut} className="w-full text-left rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
                              Sign out
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>

              {/* Enhanced Interactive Mobile Toggle Menu Trigger Button (Directly to the right of search) */}
              <button 
                className="ml-1 md:hidden h-10 w-10 flex items-center justify-center rounded-full mobile-toggle-trigger" 
                style={{ color: mutedColor }} 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileMenuOpen(m => !m);
                }}
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" style={{ color: textColor }} /> : <Menu className="h-5 w-5" style={{ color: textColor }} />}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </nav>

      {/* ── Mobile menu drawer layer panels ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed left-3 right-3 top-16 z-40 overflow-hidden rounded-2xl p-3 shadow-xl md:hidden force-light-dock"
            style={{ marginTop: "12px" }}
          >
            <div className="space-y-1 py-1">
              {navItems.map((item) => {
                const active = activeName === item.name;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-base font-medium transition-colors"
                    style={{
                      color: active ? activeColor : mutedColor,
                      background: active ? "rgba(16,185,129,0.06)" : "transparent",
                    }}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-2 space-y-2">
                <LanguagePicker />
                {!loggedIn ? (
                  <>
                    <button
                      className="w-full h-10 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-800 bg-white shadow-sm"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        gotoSignIn();
                      }}
                    >
                      Sign in
                    </button>
                    <button
                      className="w-full h-10 rounded-xl text-sm font-semibold text-white immutable-dark-btn"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        gotoSignUp();
                      }}
                    >
                      Get Started
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="w-full h-10 rounded-xl text-sm font-medium bg-white border border-neutral-200 text-neutral-800 shadow-sm"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        gotoDashboard();
                      }}
                    >
                      Dashboard
                    </button>
                    <button
                      className="w-full h-10 rounded-xl text-sm text-neutral-500 hover:bg-black/5"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DropItem({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="block rounded-xl px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-100">
      {children}
    </Link>
  );
}