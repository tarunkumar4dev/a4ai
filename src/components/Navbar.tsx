// src/components/Navbar.tsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import LanguagePicker from "@/components/LanguagePicker"; // ⬅️ new

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
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // determine active item by URL
  const { pathname } = useLocation();
  const activeName =
    navItems.find((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)))?.name ??
    "Home";

  // cursor-reactive glow
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const glow = useMotionTemplate`
    radial-gradient(140px 80px at ${mx}px ${my}px, rgba(99,102,241,0.15), transparent 70%),
    radial-gradient(160px 90px at ${mx}px ${my}px, rgba(168,85,247,0.12), transparent 75%)
  `;

  return (
    <nav className="sticky top-0 z-50">
      <div
        onMouseMove={onMouseMove}
        className="relative border-b border-gray-200/80 dark:border-gray-800/80 bg-white/75 dark:bg-gray-950/60 backdrop-blur-xl"
      >
        {/* soft animated glow */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70 pointer-events-none"
          style={{ backgroundImage: glow }}
        />

        {/* subtle gradient hairline */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex items-center gap-2">
              <img src="/ICON.ico" alt="a4ai" className="h-8 w-8" />
              <span className="text-xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                a4ai
              </span>
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
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
                    className={`text-sm font-medium transition-colors ${
                      active
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    {item.name}
                  </motion.span>

                  {/* animated active underline */}
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        layoutId="activeNavLine"
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"
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
                className="h-9 w-9 text-gray-600 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:bg-gray-800/60"
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
                    className="absolute right-0 top-0 ml-2 h-9 overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
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

            {/* Language (popover) */}
            <div className="hidden sm:block">
              <LanguagePicker />
            </div>

            {/* Theme */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-gray-600 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:bg-gray-800/60"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Auth (desktop) */}
            <div className="ml-1 hidden items-center gap-2 md:flex">
              <Link to="/login">
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/60"
                >
                  Sign in
                </Button>
              </Link>
              <Link to="/signup">
                <Button className="h-9 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-md">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 md:hidden text-gray-600 dark:text-gray-300"
              onClick={() => setMobileMenuOpen((m) => !m)}
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
              className="md:hidden overflow-hidden border-t border-gray-200 dark:border-gray-800"
            >
              <div className="space-y-1 px-2 pt-2 pb-4">
                {navItems.map((item) => {
                  const active = activeName === item.name;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded-md px-3 py-2 text-base font-medium transition-colors ${
                        active
                          ? "bg-indigo-50/70 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "text-gray-700 hover:bg-gray-100/70 dark:text-gray-300 dark:hover:bg-gray-800/70"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                {/* Mobile controls */}
                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                  {/* Language picker (mobile) */}
                  <div className="mb-2">
                    <LanguagePicker />
                  </div>

                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="mb-2 w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
