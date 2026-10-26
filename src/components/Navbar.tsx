// Navbar.tsx — Redesigned static top bar, clean premium feel
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
  // Pages outside the nav (login, signup…) highlight nothing; the Resources sub-pages highlight Resources.
  const RESOURCE_PAGES = ["/docs", "/help", "/faq", "/blog", "/case-studies"];
  const activeName = RESOURCE_PAGES.some((p) => pathname.startsWith(p))
    ? "Resources"
    : navItems.find((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)))?.name ?? null;

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

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfileOpen(false);
      setMobileMenuOpen(false);
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/contests"))
        navigate("/", { replace: true });
    }
  }, [navigate, pathname]);

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
    [handleSignOut, navigate]
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

  return (
    <>
      {/* Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#111111] focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F95D6A] text-sm font-semibold"
      >
        Skip to main content
      </a>

      <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-white border-b border-gray-200">
        <div className="w-full h-16 flex items-center px-4 sm:px-6 lg:px-8">
          {/* Logo — 40px icon, "a4ai" wordmark at 20px */}
          <div className="flex-1 flex items-center justify-start">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src="/ICON.ico"
                alt="a4ai"
                className="object-contain flex-shrink-0"
                style={{ width: "40px", height: "40px" }}
              />
              <span
                className="font-bold tracking-tight text-[#1B1B1B]"
                style={{ fontSize: "20px", lineHeight: "1.2" }}
              >
                a4ai
              </span>
            </Link>
          </div>

          {/* Center Navigation — coral active with bottom border */}
          <div className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1 flex-none">
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
                  className={`relative px-3 xl:px-3.5 py-2 text-[15px] font-medium whitespace-nowrap ${
                    active
                      ? "text-[#F95D6A]"
                      : "text-[#1B1B1B] hover:text-[#F95D6A]"
                  }`}
                >
                  {item.name}
                  {active && (
                    <span
                      className="absolute left-3 right-3 xl:left-3.5 xl:right-3.5 bottom-0 h-[2px] rounded-full"
                      style={{ backgroundColor: "#F95D6A" }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex-1 flex items-center justify-end gap-2.5 sm:gap-3">
            {/* Search */}
            <div className="relative flex items-center" ref={searchRef}>
              {searchOpen ? (
                <div
                  className="flex items-center rounded-xl h-10 bg-white border border-gray-200 shadow-sm"
                  style={{ width: typeof window !== "undefined" && window.innerWidth < 640 ? 160 : 220 }}
                >
                  <Search className="h-4 w-4 ml-3 flex-shrink-0 text-[#F95D6A]" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="flex-1 h-full bg-transparent px-2 text-sm font-medium outline-none min-w-0 text-[#1B1B1B]"
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
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-[#1B1B1B] hover:border-gray-300 cursor-pointer"
                  title="Search"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}

              {/* Suggestions dropdown */}
              {searchOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg z-[9999]">
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#5D6570]">
                    Suggestions
                  </div>
                  <div className="mt-1 space-y-0.5 max-h-[280px] overflow-y-auto">
                    {filteredSuggestions.map((item) => (
                      <div key={item.name} className="block">
                        <button
                          onClick={() => handleSearchSelect(item.path)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-[#1B1B1B] hover:bg-[#F7F8FA] hover:text-[#F95D6A] cursor-pointer"
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
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[#5D6570] hover:bg-[#F7F8FA] hover:text-[#F95D6A] cursor-pointer"
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

            <div className="hidden items-center gap-2.5 lg:flex whitespace-nowrap">
              {!loggedIn ? (
                <>
                  {/* Sign in — text link style */}
                  <button
                    onClick={gotoSignIn}
                    className="h-9 px-4 text-sm font-medium text-[#1B1B1B] hover:text-[#F95D6A] cursor-pointer"
                  >
                    Sign in
                  </button>

                  {/* Get Started — black CTA */}
                  <button
                    onClick={gotoSignUp}
                    className="h-9 px-5 rounded-lg text-sm font-semibold flex items-center gap-1.5 bg-[#111111] text-white hover:bg-[#222222] cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  {/* Dashboard — black CTA */}
                  <button
                    onClick={gotoDashboard}
                    className="h-9 px-5 rounded-lg text-sm font-semibold bg-[#111111] text-white hover:bg-[#222222] cursor-pointer"
                  >
                    Dashboard
                  </button>

                  {/* Profile icon button */}
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-[#1B1B1B] hover:border-gray-300 cursor-pointer"
                      aria-label="Profile menu"
                    >
                      <User className="h-4 w-4" />
                    </button>

                    {profileOpen && (
                      <div
                        className="absolute right-0 mt-2 w-48 rounded-xl p-1.5 bg-white border border-gray-200 shadow-lg"
                        onMouseLeave={() => setProfileOpen(false)}
                      >
                        <DropItem to="/dashboard/settings" onClick={() => setProfileOpen(false)}>Settings</DropItem>
                        <DropItem to="/dashboard" onClick={() => setProfileOpen(false)}>My Dashboard</DropItem>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-[#1B1B1B] hover:bg-[#F7F8FA] cursor-pointer"
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
              className="ml-1 lg:hidden h-10 w-10 flex items-center justify-center rounded-lg border border-gray-200 text-[#1B1B1B] bg-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMobileMenuOpen((m) => !m);
              }}
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed left-0 right-0 top-16 z-40 bg-white border-b border-gray-200 p-4 shadow-lg lg:hidden">
          <div className="space-y-1 py-1">
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
                  className={`block rounded-lg px-4 py-3 text-base font-medium ${
                    active
                      ? "text-[#F95D6A] bg-[#FFF1EC]"
                      : "text-[#1B1B1B] hover:bg-[#F7F8FA]"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-3 space-y-2.5">
              {!loggedIn ? (
                <>
                  <button
                    className="w-full h-11 rounded-lg text-sm font-medium text-[#1B1B1B] border border-gray-200 hover:bg-[#F7F8FA] cursor-pointer"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      gotoSignIn();
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    className="w-full h-11 rounded-lg text-sm font-semibold bg-[#111111] text-white hover:bg-[#222222] cursor-pointer flex items-center justify-center gap-2"
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
                    className="w-full h-11 rounded-lg text-sm font-semibold bg-[#111111] text-white hover:bg-[#222222] cursor-pointer"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      gotoDashboard();
                    }}
                  >
                    Dashboard
                  </button>
                  <button
                    className="w-full h-11 rounded-lg text-sm font-medium text-[#1B1B1B] border border-gray-200 hover:bg-[#F7F8FA] cursor-pointer"
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
      className="block rounded-lg px-3 py-2 text-sm font-medium text-[#1B1B1B] hover:bg-[#F7F8FA]"
    >
      {children}
    </Link>
  );
}
