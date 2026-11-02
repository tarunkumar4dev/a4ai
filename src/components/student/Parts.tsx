// Layout and small building blocks shared by the student pages. Page-specific pieces stay with their page.
import type { ReactNode } from "react";
import { Helmet } from "react-helmet";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useAccess } from "@/context/AccessProvider";
import { useCoins } from "@/context/CoinContext";
import { resolveHomeRoute } from "@/lib/homeRoute";
import { StudentNav } from "./StudentNav";
import { BTN_PRIMARY_MD } from "./ui";
import { cn } from "@/lib/utils";

/** Who is looking: name, landing route, student or not, real coin balance (null = unknown). */
export function useStudentShell() {
  const { user, role } = useAuth();
  const { access } = useAccess();
  const { balance } = useCoins();
  const name = (user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim();
  return {
    user,
    uid: user?.id ?? null,
    name,
    firstName: name.split(/\s+/)[0] || "",
    email: user?.email ?? null,
    isStudent: (role || "").toLowerCase().trim() === "student",
    home: resolveHomeRoute(access, role),
    balance,
  };
}

/** Nav + page container; with `sidebar` a main column and a 300–320 px side column from lg. */
export function StudentLayout({ title, children, sidebar }: { title: string; children: ReactNode; sidebar?: ReactNode }) {
  const s = useStudentShell();
  return (
    <div className="min-h-screen bg-white text-[#1B1B1B]">
      <Helmet><title>{title} · a4ai</title></Helmet>
      <StudentNav home={s.home} isStudent={s.isStudent} name={s.name} email={s.email} balance={s.balance} />
      <main className="mx-auto max-w-[1280px] px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-5 lg:px-6 lg:pt-7">
        {sidebar ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
            <div className="min-w-0">{children}</div>
            <aside className="mt-10 space-y-4 lg:mt-0">{sidebar}</aside>
          </div>
        ) : children}
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="font-halenoir text-[26px] font-extrabold leading-tight tracking-tight md:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-[#5D6570]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function SectionHeader({ title, count, dot, action, id }: {
  title: string; count?: number | string; dot?: string; action?: ReactNode; id?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />}
      <h2 id={id} className="font-halenoir text-[17px] font-bold text-[#1B1B1B]">{title}</h2>
      {count != null && <span className="text-[13px] font-medium tabular-nums text-[#5D6570]">{count}</span>}
      <span className="h-px flex-1 bg-[#E5E7EB]" aria-hidden />
      {action}
    </div>
  );
}

/** One number with its label. value null → "—" (unknown is never shown as 0). */
export function StatTile({ label, value, hint, accent = "#14243A" }: { label: string; value: ReactNode | null; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} aria-hidden />
        <p className="text-[12px] font-medium text-[#5D6570]">{label}</p>
      </div>
      <p className="mt-1 font-halenoir text-[22px] font-extrabold leading-none tabular-nums text-[#1B1B1B]">{value ?? "—"}</p>
      {hint && <p className="mt-1 truncate text-[11.5px] text-[#5D6570]" title={hint}>{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, className }: {
  icon: ReactNode; title: string; body?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-[#D5D9DF] bg-[#FAFBFC] px-6 py-10 text-center", className)}>
      <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-[#FBF4F5] text-[#A92532]">
        {icon}
        <span aria-hidden className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#E5A526]" />
      </span>
      <p className="mt-4 font-halenoir text-[16px] font-bold text-[#1B1B1B]">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-[#5D6570]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-xl border border-[#F3C9CE] bg-[#FDF6F7] px-6 py-8 text-center", className)}>
      <AlertTriangle size={22} aria-hidden className="text-[#A92532]" />
      <p className="mt-2 text-[14px] font-semibold text-[#1B1B1B]">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className={cn(BTN_PRIMARY_MD, "mt-4")}>Try again</button>}
    </div>
  );
}

// text on tint ≥ 5.4:1
const DIFF: Record<string, { label: string; cls: string }> = {
  easy: { label: "Easy", cls: "bg-[#E7F6EE] text-[#0E6B43]" },
  medium: { label: "Medium", cls: "bg-[#FDF4E3] text-[#7A5200]" },
  hard: { label: "Hard", cls: "bg-[#FBEBED] text-[#A92532]" },
};

export function DifficultyBadge({ level }: { level: string | null | undefined }) {
  const d = DIFF[(level || "").toLowerCase()];
  if (!d) return null;
  return <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-[11.5px] font-semibold", d.cls)}>{d.label}</span>;
}

/** Plain bordered side-panel card. */
export function SideCard({ title, icon, children, className, labelledBy }: {
  title?: string; icon?: ReactNode; children: ReactNode; className?: string; labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn("rounded-xl border border-[#E5E7EB] bg-white p-4", className)}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F5F6F8] text-[#14243A]">{icon}</span>}
          <h2 id={labelledBy} className="font-halenoir text-[15px] font-bold text-[#1B1B1B]">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}
