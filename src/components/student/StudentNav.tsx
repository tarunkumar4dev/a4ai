// Top navigation for the student experience (dashboard, contests, practice, rewards): logo, the destinations that
// exist, coins (only a balance read from the database), account menu. Phones: a menu button instead of the link
// row. The only sticky element on these pages. Teachers who open /contests get their own short list.
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Award, ChevronDown, LayoutDashboard, LogOut, Menu, Settings } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FOCUS_RING } from "./ui";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; end?: boolean };

export function studentNavItems(home: string, isStudent: boolean): NavItem[] {
  return isStudent
    ? [
        { to: home, label: "Dashboard", end: true },
        { to: "/contests", label: "Contests", end: true },
        { to: "/practice", label: "Practice" },
        { to: "/dashboard/flashcards", label: "Flashcards" },
        { to: "/notes", label: "Notes" },
        { to: "/rewards", label: "Rewards" },
      ]
    : [
        { to: home, label: "Dashboard", end: true },
        { to: "/contests", label: "Contests", end: true },
        { to: "/contests/mine", label: "My contests" },
        { to: "/rewards", label: "Rewards" },
      ];
}

export function StudentNav({ home, isStudent, name, email, balance }: {
  home: string; isStudent: boolean; name: string; email: string | null; balance: number | null;
}) {
  const navigate = useNavigate();
  const items = studentNavItems(home, isStudent);
  const signOut = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    navigate("/login", { replace: true });
  };
  const initial = (name[0] || email?.[0] || "?").toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-4 lg:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Open menu" className={cn("grid h-11 w-11 place-items-center rounded-lg text-[#1B1B1B] hover:bg-[#F5F6F8] lg:hidden", FOCUS_RING)}>
            <Menu size={20} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {items.map((it) => (
              <DropdownMenuItem key={it.to} onSelect={() => navigate(it.to)} className="h-11 text-[15px]">{it.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link to="/" aria-label="a4ai home" className={cn("flex shrink-0 items-center gap-2 rounded-lg pr-2", FOCUS_RING)}>
          <img src="/images/LOGO.png" alt="" width={28} height={28} className="h-7 w-7 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <span className="font-halenoir text-[17px] font-extrabold tracking-tight text-[#1B1B1B]">a4ai</span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden h-full items-stretch gap-1 lg:flex">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
              className={({ isActive }) => cn(
                "relative inline-flex items-center px-3 text-[14px] font-medium",
                isActive
                  ? "text-[#1B1B1B] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#A92532]"
                  : "text-[#5D6570] hover:text-[#1B1B1B]",
                FOCUS_RING,
              )}>
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {balance != null && (
            <Link to="/rewards" aria-label={`${balance} coins — open rewards`}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border border-[#F2D9A2] bg-[#FFF8E8] px-3 text-[13px] font-semibold text-[#7A5200]", FOCUS_RING)}>
              <Award size={15} aria-hidden /> <span className="tabular-nums">{balance.toLocaleString("en-IN")}</span>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Account menu" className={cn("flex items-center gap-1 rounded-full pl-0.5 pr-1.5", FOCUS_RING)}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#14243A] text-[14px] font-bold text-white">{initial}</span>
              <ChevronDown size={14} aria-hidden className="hidden text-[#5D6570] sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-[14px] font-semibold text-[#1B1B1B]">{name || "Your account"}</p>
                {email && <p className="truncate text-[12px] text-[#5D6570]">{email}</p>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate(home)} className="h-10 gap-2"><LayoutDashboard size={16} aria-hidden /> My dashboard</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/settings")} className="h-10 gap-2"><Settings size={16} aria-hidden /> Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} className="h-10 gap-2 text-[#A92532] focus:text-[#A92532]"><LogOut size={16} aria-hidden /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
