// =======================================
// src/pages/JoinContestPageAurora.tsx
// Clean join screen with steps + glass UI
// =======================================
import React from "react";
import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Timer, Shield, CheckCircle2 } from "lucide-react";

type JoinState = {
  contest?: {
    id: string;
    title: string;
    duration: string;
    participants: number;
    type: string;
    difficulty: string;
  };
};

export const JoinContestPageAurora: React.FC = () => {
  const { state } = useLocation() as { state: JoinState };
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const contest = state?.contest ?? {
    id: id || "unknown",
    title: "Contest",
    duration: "—",
    participants: 0,
    type: "—",
    difficulty: "—",
  };

  const [name, setName] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const canJoin = name.trim().length > 1 && agree;

  const join = () => {
    // TODO: Call your backend API here; navigate to lobby/room/etc.
    alert(`Welcome, ${name}! You’re in 🎉`);
  
    // Go to the main Join page
    navigate("/contests/join", {
      state: { contest },
    });
  };
  
  

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="absolute inset-0
        bg-[radial-gradient(1000px_600px_at_12%_-10%,#EDF1F7_0%,transparent_60%),radial-gradient(1000px_600px_at_88%_110%,#F7FAFF_0%,transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none
        [background-image:linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)]
        [background-size:48px_48px]" />

      <div className="relative max-w-3xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <div className="rounded-2xl ring-1 ring-black/10 bg-white/85 backdrop-blur shadow-[0_30px_80px_-20px_rgba(2,6,23,0.45)] overflow-hidden">
          {/* Header block */}
          <div className="relative p-6 md:p-7 bg-gradient-to-br from-white/80 to-white/40">
            <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-1
                            bg-white/70 backdrop-blur text-slate-700 text-xs font-medium ring-1 ring-black/10">
              Join Contest
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
              {contest.title}
            </h1>
            <div className="text-sm text-slate-600">
              ID: {contest.id} • {contest.type} • {contest.difficulty}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <MiniStat icon={Timer} label="Duration" value={contest.duration} />
              <MiniStat icon={Users} label="Participants" value={contest.participants.toLocaleString()} />
              <MiniStat icon={Shield} label="Mode" value="Proctored" />
            </div>
          </div>

          {/* Steps */}
          <div className="p-6 md:p-7 space-y-5">
            <div>
              <label className="text-sm text-slate-700">Display name</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 bg-white/80
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="rounded-xl p-4 bg-slate-50 ring-1 ring-slate-200 flex items-start gap-3">
              <Shield className="h-5 w-5 text-slate-700 mt-0.5" />
              <div className="text-sm text-slate-700">
                We’ll only use camera/mic during live rounds for fairness. Nothing is stored without consent.
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-[2px]"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span className="flex-1">
                I agree to the contest rules & honor code.
                <ul className="mt-2 space-y-1 text-slate-600">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-[2px]" /> No external help or multiple accounts.</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 mt-[2px]" /> Keep camera on (if asked) and avoid tab switching.</li>
                </ul>
              </span>
            </label>

            <div className="pt-2">
              <button
                disabled={!canJoin}
                onClick={join}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm text-white transition
                            ${canJoin
                              ? "bg-[linear-gradient(180deg,#93c5fd,#3b82f6_85%)] ring-1 ring-blue-300 shadow-[0_10px_24px_rgba(59,130,246,0.25)] hover:brightness-105"
                              : "bg-slate-300 cursor-not-allowed"}`}
              >
                Confirm & Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl p-3 bg-white/75 ring-1 ring-black/10 flex items-center gap-3
                    shadow-[0_10px_24px_-18px_rgba(2,6,23,0.28)]">
      <div className="h-9 w-9 rounded-xl grid place-items-center bg-slate-100">
        <Icon className="h-4 w-4 text-slate-700" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

export default JoinContestPageAurora;
