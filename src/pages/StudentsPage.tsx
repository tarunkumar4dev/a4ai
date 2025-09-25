// src/pages/StudentsPage.tsx — Cluely-blue themed, modern & animated roster
// - Blue accents only (no purple), neutral greys, soft gradients
// - Framer Motion micro-interactions
// - Sorting, filtering, pagination
// - Headless invite dialog (works with shadcn inputs/buttons)

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Mail,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ShieldAlert,
} from "lucide-react";

/* =====================================================================
   Types
===================================================================== */
type Status = "Active" | "Invited" | "Suspended";

type Student = {
  id: string;
  name: string;
  email: string;
  className: string;
  status: Status;
};

/* =====================================================================
   Mock Data (replace with API later)
===================================================================== */
const MOCK: Student[] = [
  { id: "1",  name: "Aarav Sharma",  email: "aarav@example.com", className: "Class 10", status: "Active" },
  { id: "2",  name: "Diya Verma",    email: "diya@example.com",  className: "Class 9",  status: "Invited" },
  { id: "3",  name: "Kabir Singh",   email: "kabir@example.com", className: "Class 10", status: "Active" },
  { id: "4",  name: "Ira Kapoor",    email: "ira@example.com",   className: "Class 8",  status: "Suspended" },
  { id: "5",  name: "Mihir Sethi",   email: "mihir@example.com", className: "Class 9",  status: "Active" },
  { id: "6",  name: "Neha Rao",      email: "neha@example.com",  className: "Class 10", status: "Invited" },
  { id: "7",  name: "Riya Mehta",    email: "riya@example.com",  className: "Class 8",  status: "Active" },
  { id: "8",  name: "Vihaan Iyer",   email: "vihaan@example.com",className: "Class 10", status: "Active" },
  { id: "9",  name: "Sara Khan",     email: "sara@example.com",  className: "Class 9",  status: "Suspended" },
  { id: "10", name: "Arjun Patel",   email: "arjun@example.com", className: "Class 8",  status: "Active" },
];

/* =====================================================================
   Helpers (Cluely-blue theme)
===================================================================== */
const STATUS_STYLES: Record<Status, string> = {
  Active:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
  Invited:   "bg-sky-100  text-sky-700  dark:bg-sky-900/30  dark:text-sky-200",
  Suspended: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200",
};

function StatusPill({ status }: { status: Status }) {
  return <Badge className={`${STATUS_STYLES[status]} font-medium px-2.5 py-0.5`}>{status}</Badge>;
}

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

/* =====================================================================
   Main Component
===================================================================== */
export default function StudentsPage() {
  // ---------------------------- local state ----------------------------
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [classFilter, setClassFilter] =
    useState<"All" | "Class 8" | "Class 9" | "Class 10">("All");
  const [sortKey, setSortKey] = useState<keyof Student>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  // --------------------------- debounce search -------------------------
  useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery.trim().toLowerCase()), 220);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // ------------------------------- derived -----------------------------
  const filtered = useMemo(() => {
    let list = MOCK;

    if (query) {
      list = list.filter((x) =>
        x.name.toLowerCase().includes(query) ||
        x.email.toLowerCase().includes(query) ||
        x.className.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== "All") list = list.filter((x) => x.status === statusFilter);
    if (classFilter !== "All") list = list.filter((x) => x.className === classFilter);

    list = [...list].sort((a, b) => {
      const aVal = String(a[sortKey]).toLowerCase();
      const bVal = String(b[sortKey]).toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [query, statusFilter, classFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  // ------------------------------ handlers -----------------------------
  const toggleSort = (key: keyof Student) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const onInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const className = String(fd.get("className") || "");

    if (!name || !email) {
      toast.error("Name and email are required");
      return;
    }
    // Hook with Supabase later
    toast.success(`Invitation sent to ${name}`);
    (e.target as HTMLFormElement).reset();
  };

  /* ================================ UI ================================ */
  return (
    <div className="relative">
      {/* Cluely-like soft background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,#EAF1FF_0%,#F7F9FC_60%,transparent_100%)]"
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-cyan-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-blue-200/40 dark:ring-blue-300/20">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live — Roster
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Students
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage enrolled students, invites, and statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <InviteDialog onSubmit={onInvite} />
          </div>
        </motion.div>

        {/* Controls + Table */}
        <Card className="p-4 shadow-sm">
          {/* Controls */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search by name, email, class…"
                className="pl-9"
              />
              <motion.span
                layoutId="underline"
                className="absolute left-3 right-3 bottom-0 h-px bg-gradient-to-r from-blue-500/60 via-sky-500/60 to-cyan-500/60"
              />
            </div>

            {/* Class Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Class</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as any)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option>All</option>
                <option>Class 8</option>
                <option>Class 9</option>
                <option>Class 10</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option>All</option>
                <option>Active</option>
                <option>Invited</option>
                <option>Suspended</option>
              </select>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 items-center gap-3 rounded-md border border-dashed border-border p-2 text-center text-sm">
              <div>
                <div className="font-semibold">{filtered.length}</div>
                <div className="text-xs text-muted-foreground">Results</div>
              </div>
              <div>
                <div className="font-semibold">
                  {MOCK.filter((x) => x.status === "Active").length}
                </div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div>
                <div className="font-semibold">
                  {MOCK.filter((x) => x.status === "Invited").length}
                </div>
                <div className="text-xs text-muted-foreground">Invited</div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border/60">
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                    Name
                  </Th>
                  <Th onClick={() => toggleSort("email")} active={sortKey === "email"} dir={sortDir}>
                    Email
                  </Th>
                  <Th
                    onClick={() => toggleSort("className")}
                    active={sortKey === "className"}
                    dir={sortDir}
                  >
                    Class
                  </Th>
                  <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>
                    Status
                  </Th>
                  <th className="py-3 pr-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                <AnimatePresence initial={false}>
                  {paginated.map((s) => (
                    <motion.tr
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="group border-b border-border/40 hover:bg-muted/40"
                    >
                      <td className="py-3 pr-4 font-medium">{s.name}</td>
                      <td className="py-3 pr-4 text-foreground/90">{s.email}</td>
                      <td className="py-3 pr-4">{s.className}</td>
                      <td className="py-3 pr-4">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex justify-end gap-2 opacity-80 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            View
                          </Button>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                            Message
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}

                  {paginated.length === 0 && (
                    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        No students match your filters.
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Page {pageSafe} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageSafe === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pageSafe === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>

        {/* Safety banner */}
        <div className="mt-4 flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-blue-800 dark:text-blue-200">
          <ShieldAlert className="h-4 w-4" />
          <p className="text-xs">
            Tip: Wire this UI to Supabase. Create a <code>students</code> table and replace the MOCK array with data from an RPC/Edge Function.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   Subcomponents
===================================================================== */
function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "select-none py-3 pr-4 text-left text-muted-foreground",
        onClick && "cursor-pointer hover:text-foreground"
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick &&
          (active ? (
            dir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" />
          ))}
      </span>
    </th>
  );
}

/* =====================================================================
   Invite Dialog (headless — uses native-like card)
===================================================================== */
function InviteDialog({ onSubmit }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="gap-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" />
        Invite Student
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />

            {/* card */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="relative z-10 w-[min(560px,92vw)] rounded-2xl border border-border bg-background p-5 shadow-xl"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold tracking-tight">Invite a student</h3>
                <p className="text-sm text-muted-foreground">Send an email invite to join your class on a4ai.</p>
              </div>

              <form
                onSubmit={(e) => {
                  onSubmit(e);
                  setOpen(false);
                }}
                className="grid gap-3"
              >
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Full name</label>
                  <Input name="name" placeholder="e.g. Rohan Gupta" />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input name="email" type="email" placeholder="student@mail.com" className="pl-9" />
                </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Class</label>
                  <select
                    name="className"
                    defaultValue="Class 10"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option>Class 8</option>
                    <option>Class 9</option>
                    <option>Class 10</option>
                  </select>
                </div>

                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Send Invite
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
