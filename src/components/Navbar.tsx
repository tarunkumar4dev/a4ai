// Navbar.tsx — Static full-width top bar, Black and Peach buttons
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { Search, Menu, X, ArrowRight, User, Settings, LayoutDashboard, LogOut, ChevronRight } from "lucide-react";

const navItems = [
  { name: "Home", path: "/" },
  { name: "AI Tools", path: "/#ai-tools" },
  { name: "Features", path: "/features" },
  { name: "Pricing", path: "/pricing" },
  { name: "Resources", path: "/resources" },
  { name: "About", path: "/about" },
];

interface SuggestionItem {
  name: string;
  path: string;
  subOptions?: { name: string; path: string; icon: any }[];
}

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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-white border-b border-gray-200">
        <div className="w-full h-20 flex items-center px-4 sm:px-6 lg:px-8">
          {/* Logo — 2x icon size (64px) and 1.5x text size (30px) */}
          <div className="flex-1 flex items-center justify-start">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/ICON.ico"
                alt="a4ai"
                className="h-16 w-16 object-contain flex-shrink-0"
                style={{ width: "64px", height: "64px" }}
              />
              <span
                className="font-semibold tracking-tight text-gray-900"
                style={{ fontSize: "30px", lineHeight: "1.1" }}
              >
                a4ai
              </span>
            </Link>
          </div>

          {/* Center Navigation toolbar buttons with Peach active background */}
          <div className="hidden md:flex items-center justify-center gap-2 flex-none">
            {navItems.map((item) => {
              const active = activeName === item.name;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={(e) => {
                    if (item.path.includes("#ai-tools") && pathname === "/") {
                      e.preventDefault();
                      document.getElementById("ai-tools")?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className={`px-4 py-2 rounded-[10px] text-[15px] font-bold border transition-colors ${
                    active
                      ? "border-[#fecdd3]"
                      : "text-gray-900 border-transparent hover:text-black hover:bg-gray-100"
                  }`}
                  style={
                    active
                      ? {
                          color: "#f75961",
                          backgroundColor: "#fff0f1",
                          borderColor: "#fecdd3",
                        }
                      : undefined
                  }
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Actions — Peach (Sign in) & Black (Get Started) Buttons */}
          <div className="flex-1 flex items-center justify-end gap-2.5 sm:gap-3">
            {/* Search */}
            <div className="relative flex items-center" ref={searchRef}>
              {searchOpen ? (
                <div
                  className="flex items-center rounded-[12px] h-10 bg-white border border-gray-300 shadow-sm"
                  style={{ width: typeof window !== "undefined" && window.innerWidth < 640 ? 160 : 220 }}
                >
                  <Search className="h-4 w-4 ml-3 flex-shrink-0" style={{ color: "#f75961" }} />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="flex-1 h-full bg-transparent px-2 text-sm font-semibold outline-none min-w-0 text-gray-900"
                  />
                  <button
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="mr-2.5 flex-shrink-0 text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="h-10 w-10 flex items-center justify-center rounded-[12px] border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer"
                  title="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}

              {/* Suggestions dropdown */}
              {searchOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-[14px] border border-gray-200 bg-white p-2 shadow-xl z-[9999]">
                  <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Suggestions
                  </div>
                  <div className="mt-1 space-y-0.5 max-h-[280px] overflow-y-auto">
                    {filteredSuggestions.map((item) => (
                      <div key={item.name} className="block">
                        <button
                          onClick={() => handleSearchSelect(item.path)}
                          className="flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm font-bold text-gray-800 hover:bg-[#fff0f1] hover:text-[#f75961] cursor-pointer"
                        >
                          <span>{item.name}</span>
                          {!item.subOptions && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
                        </button>

                        {item.subOptions && (
                          <div className="ml-3 mt-0.5 border-l border-gray-100 pl-2 space-y-0.5">
                            {item.subOptions.map((sub) => {
                              const SubIcon = sub.icon;
                              return (
                                <button
                                  key={sub.name}
                                  onClick={() => handleSearchSelect(sub.path)}
                                  className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-xs font-bold text-gray-600 hover:bg-[#fff0f1] hover:text-[#f75961] cursor-pointer"
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

            <div className="hidden items-center gap-2.5 md:flex">
              {!loggedIn ? (
                <>
                  {/* Solid Peach Filled Button */}
                  <button
                    onClick={gotoSignIn}
                    className="h-10 px-5 text-sm font-bold rounded-[14px] bg-[#f75961] hover:bg-[#e8454d] text-white border border-[#f75961] transition-colors cursor-pointer"
                  >
                    Sign in
                  </button>

                  {/* Black Button */}
                  <button
                    onClick={gotoSignUp}
                    className="h-10 px-5 rounded-[14px] text-sm font-bold flex items-center gap-1.5 bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={gotoDashboard}
                    className="h-10 px-5 rounded-[14px] text-sm font-bold bg-black text-white hover:bg-neutral-800 cursor-pointer"
                  >
                    Dashboard
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="h-10 inline-flex items-center gap-2 rounded-[14px] px-4 text-sm font-bold bg-black text-white hover:bg-neutral-800 cursor-pointer"
                    >
                      <User className="h-4 w-4 text-white" />
                      <span className="hidden lg:inline">Profile</span>
                    </button>

                    {profileOpen && (
                      <div
                        className="absolute right-0 mt-2 w-48 rounded-[14px] p-1.5 bg-white border border-gray-200 shadow-xl"
                        onMouseLeave={() => setProfileOpen(false)}
                      >
                        <DropItem to="/dashboard/settings" onClick={() => setProfileOpen(false)}>Settings</DropItem>
                        <DropItem to="/dashboard" onClick={() => setProfileOpen(false)}>My Dashboard</DropItem>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left rounded-[10px] px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="ml-1 md:hidden h-10 w-10 flex items-center justify-center rounded-[12px] border border-gray-200 text-gray-800 bg-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMobileMenuOpen((m) => !m);
              }}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed left-0 right-0 top-20 z-40 bg-white border-b border-gray-200 p-4 shadow-lg md:hidden">
          <div className="space-y-1.5 py-1">
            {navItems.map((item) => {
              const active = activeName === item.name;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    if (item.path.includes("#ai-tools") && pathname === "/") {
                      e.preventDefault();
                      document.getElementById("ai-tools")?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className={`block rounded-[10px] px-4 py-3 text-base font-bold ${
                    active
                      ? "border border-[#fecdd3]"
                      : "text-gray-900 hover:bg-gray-100"
                  }`}
                  style={
                    active
                      ? {
                          color: "#f75961",
                          backgroundColor: "#fff0f1",
                          borderColor: "#fecdd3",
                        }
                      : undefined
                  }
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-3 space-y-2.5">
              {!loggedIn ? (
                <>
                  <button
                    className="w-full h-11 rounded-[14px] text-sm font-bold bg-[#f75961] hover:bg-[#e8454d] text-white border border-[#f75961] cursor-pointer"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      gotoSignIn();
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    className="w-full h-11 rounded-[14px] text-sm font-bold bg-black text-white hover:bg-neutral-800 cursor-pointer flex items-center justify-center gap-2"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      gotoSignUp();
                    }}
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="w-full h-11 rounded-[14px] text-sm font-bold bg-black text-white hover:bg-neutral-800 cursor-pointer"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      gotoDashboard();
                    }}
                  >
                    Dashboard
                  </button>
                  <button
                    className="w-full h-11 rounded-[14px] text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-100 cursor-pointer"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DropItem({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block rounded-[10px] px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-100"
    >
      {children}
    </Link>
  );
}