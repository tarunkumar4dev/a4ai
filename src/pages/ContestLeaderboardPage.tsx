// src/pages/ContestLeaderboardPage.tsx — /contests/leaderboard?c=<short_code>[&id=<contest_id>]
// Student-facing leaderboard: hero, podium for the top 3, ranked list, "You" row, row details, badges.
// Privacy: only names, scores and time are shown (emails / tab switches are never rendered, even for a teacher).
// teacher_release before publishing → "Results coming soon" card.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, Crown, Loader2, Search, Users, X } from "lucide-react";
import { contestApi, type LeaderboardResponse } from "@/lib/contestApi";
import { CONTEST_FONT_STACK, CONTEST_NAVY, useContestFont } from "@/lib/contestFont";
import {
  avatarColour, badgesFor, displayName, initials, mmss, myAttemptId, percentOf, rankRows, rememberContestId,
  rememberedContestId, scoreTone, type Ranked,
} from "@/lib/leaderboard";
import { burstConfetti, useCountUp } from "@/components/contest/results/motion";

const GRADIENT = `linear-gradient(135deg, ${CONTEST_NAVY} 0%, #4338CA 55%, #7C3AED 100%)`;
type Filter = "all" | "top10" | "me";

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="rounded-full text-white font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: avatarColour(name), fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

function PodiumBlock({ row, place, height, delay }: { row: Ranked; place: 1 | 2 | 3; height: number; delay: number }) {
  const h = useCountUp(height, 800, delay);
  const score = useCountUp(row.score ?? 0, 900, delay);
  const name = displayName(row);
  const p = percentOf(row);
  return (
    <div className="flex flex-col items-center justify-end min-w-0 flex-1" data-testid={`podium-${place}`}>
      {place === 1 && <Crown size={26} className="text-amber-400 mb-0.5" aria-hidden />}
      <div className={`rounded-full p-0.5 ${row.is_me ? "ring-4 ring-amber-300" : ""}`}><Avatar name={name} size={place === 1 ? 60 : 50} /></div>
      {/* up to 2 lines; "You" is a pill so it is never cut off with the name */}
      <p className="mt-1.5 text-sm font-bold text-white text-center line-clamp-2 break-words max-w-full px-1 leading-tight" title={name}>{name}</p>
      {row.is_me && <span className="mt-1 px-2 py-0.5 rounded-full bg-amber-300 text-[11px] font-bold text-amber-950" data-testid="podium-you">You</span>}
      <p className="text-xs text-indigo-100 tabular-nums">{Math.round(score)}/{row.total_marks} · {Math.round(p)}% · {mmss(row.time_taken_seconds)}</p>
      <div className="mt-2 w-full rounded-t-2xl flex items-start justify-center pt-2 font-black text-2xl text-[#1F3A68]"
        style={{ height: Math.max(8, h), background: place === 1 ? "#FDE68A" : place === 2 ? "#E0E7FF" : "#FBCFE8" }}>
        {place}
      </div>
    </div>
  );
}

function Detail({ row, all, onClose }: { row: Ranked; all: Ranked[]; onClose?: () => void }) {
  const name = displayName(row);
  const p = percentOf(row);
  const answered = (row.correct ?? 0) + (row.wrong ?? 0);
  const accuracy = answered ? Math.round(((row.correct ?? 0) / answered) * 100) : null;
  const badges = badgesFor(row, all);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-gray-900 truncate">{name}{row.is_me ? " (You)" : ""}</p>
          <p className="text-sm text-gray-700">Rank #{row.rank} of {all.length}</p>
        </div>
        {onClose && <button onClick={onClose} aria-label="Close" className="h-11 w-11 rounded-xl bg-gray-100 flex items-center justify-center"><X size={18} /></button>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-gray-50 border border-gray-200 py-3"><p className="text-lg font-bold tabular-nums">{row.score ?? "—"}/{row.total_marks}</p><p className="text-[11px] font-semibold text-gray-700">Score</p></div>
        <div className="rounded-2xl bg-gray-50 border border-gray-200 py-3"><p className={`text-lg font-bold tabular-nums ${scoreTone(p).text}`}>{Math.round(p)}%</p><p className="text-[11px] font-semibold text-gray-700">Percent</p></div>
        <div className="rounded-2xl bg-gray-50 border border-gray-200 py-3"><p className="text-lg font-bold tabular-nums">{mmss(row.time_taken_seconds)}</p><p className="text-[11px] font-semibold text-gray-700">Time</p></div>
      </div>
      {row.correct != null && (
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl bg-green-50 border border-green-200 py-2.5"><p className="font-bold text-green-900 tabular-nums">{row.correct}</p><p className="text-[11px] font-semibold text-green-900">Correct</p></div>
          <div className="rounded-2xl bg-red-50 border border-red-200 py-2.5"><p className="font-bold text-red-900 tabular-nums">{row.wrong ?? 0}</p><p className="text-[11px] font-semibold text-red-900">Wrong</p></div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 py-2.5"><p className="font-bold text-gray-900 tabular-nums">{row.left ?? 0}</p><p className="text-[11px] font-semibold text-gray-700">Left</p></div>
          <div className="rounded-2xl bg-indigo-50 border border-indigo-200 py-2.5"><p className="font-bold text-indigo-900 tabular-nums">{accuracy != null ? `${accuracy}%` : "—"}</p><p className="text-[11px] font-semibold text-indigo-900">Accuracy</p></div>
        </div>
      )}
      {badges.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Badges">
          {badges.map((b) => <li key={b.id} className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">{b.emoji} {b.label}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function ContestLeaderboardPage() {
  useContestFont();
  const [params] = useSearchParams();
  const code = params.get("c") || "";
  const idParam = params.get("id");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [meta, setMeta] = useState<{ subject?: string; class_grade?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [meVisible, setMeVisible] = useState(true);
  const meRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      let id = idParam || (code ? rememberedContestId(code) : null);
      if (!id && code) {
        const info = await contestApi.getContestInfo(code);
        id = info.contest_id;
        setMeta({ subject: info.subject, class_grade: info.class_grade });
        rememberContestId(code, id);
      } else if (code) {
        contestApi.getContestInfo(code).then((i) => setMeta({ subject: i.subject, class_grade: i.class_grade })).catch(() => {});
      }
      if (!id) throw new Error("This leaderboard link is incomplete.");
      setData(await contestApi.getLeaderboard(id, code ? myAttemptId(code) : null));
    } catch (e: any) {
      setError(e?.message || "Could not load the leaderboard");
    }
  }, [code, idParam]);
  useEffect(() => { load(); }, [load]);

  const ranked = useMemo(() => rankRows(data?.attempts || []), [data]);
  const me = ranked.find((r) => r.is_me) || null;
  const total = data?.total_participants || ranked.length;
  const myRank = me?.rank ?? data?.my_rank ?? null;

  // one small celebration: own rank in the top 3 or ≥ 80 %
  useEffect(() => {
    if (!me || !data) return;
    if (!(me.rank <= 3 || percentOf(me) >= 80)) return;
    const k = `a4_confetti_${data.contest_id}`;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* ignore */ }
    burstConfetti();
  }, [me, data]);

  // "You" bar when the own row is off-screen (phones)
  useEffect(() => {
    const el = meRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setMeVisible(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  });

  const searching = q.trim().length > 0;
  const showPodium = filter === "all" && !searching && ranked.length > 0;
  const listRows = useMemo(() => {
    let rows = ranked;
    if (searching) rows = rows.filter((r) => displayName(r).toLowerCase().includes(q.trim().toLowerCase()));
    else if (filter === "top10") rows = rows.filter((r) => r.rank <= 10);
    else if (filter === "me" && me) rows = rows.filter((r) => Math.abs(r.rank - me.rank) <= 3);
    else if (showPodium) rows = rows.slice(3);
    return rows;
  }, [ranked, searching, q, filter, me, showPodium]);
  const sel = ranked.find((r) => r.attempt_id === selected) || null;
  const scrollToMe = () => { setFilter("all"); setQ(""); setTimeout(() => meRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };

  const top3 = ranked.slice(0, 3);
  const podiumOrder: [Ranked | undefined, 1 | 2 | 3, number][] = [[top3[1], 2, 96], [top3[0], 1, 132], [top3[2], 3, 72]];

  return (
    <div className="min-h-screen bg-[#F4F6FA] pb-24" style={{ fontFamily: CONTEST_FONT_STACK }}>
      {/* HERO */}
      <header className="text-white" style={{ background: GRADIENT }}>
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-6">
          <Link to={code ? `/contest/${code}` : "/contests"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-100 min-h-[44px]"><ArrowLeft size={16} /> Back</Link>
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{data?.title || "Leaderboard"}</h1>
          <p className="text-sm text-indigo-100 mt-0.5">{[meta?.subject, meta?.class_grade && (/^\d+$/.test(meta.class_grade) ? `Class ${meta.class_grade}` : meta.class_grade)].filter(Boolean).join(" · ")}</p>
          {data && !data.results_pending && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold bg-white/15 rounded-full px-3 py-1"><Users size={14} /> {total} student{total === 1 ? "" : "s"} took this test</p>
          )}

          {showPodium && (
            <div className="mt-6 flex items-end gap-2 sm:gap-4 max-w-md mx-auto" aria-label="Top 3">
              {podiumOrder.map(([row, place, h], i) => row
                ? <PodiumBlock key={place} row={row} place={place} height={h} delay={i * 120} />
                : <div key={place} className="flex-1" />)}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 -mt-2">
        {error && (
          <div className="mt-4 rounded-2xl bg-white border border-red-200 p-4 text-sm text-red-800 flex items-center justify-between gap-3">
            {error}<button onClick={load} className="min-h-[44px] px-4 rounded-xl text-white text-sm font-bold" style={{ background: CONTEST_NAVY }}>Retry</button>
          </div>
        )}
        {!data && !error && <p className="mt-6 text-sm text-gray-700 inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading leaderboard…</p>}

        {data?.results_pending && (
          <div className="mt-6 rounded-2xl bg-white shadow-sm border border-indigo-100 p-8 text-center" data-testid="results-pending">
            <p className="text-5xl" aria-hidden>🎉</p>
            <p className="mt-3 text-lg font-bold text-gray-900">Results coming soon</p>
            <p className="text-sm text-gray-700 mt-1">Your teacher will publish them. Check back later.</p>
          </div>
        )}

        {data && !data.results_pending && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px] items-start">
            <section>
              {myRank != null && (
                <p className="mb-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-bold text-amber-900" data-testid="you-are">
                  You are #{myRank} of {total}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <label className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name" aria-label="Search a name"
                    className="w-full min-h-[44px] rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <div className="flex gap-2" role="group" aria-label="Filter">
                  {([["all", "All"], ["top10", "Top 10"], ["me", "My position"]] as [Filter, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => { setFilter(k); setQ(""); }} aria-pressed={filter === k} disabled={k === "me" && !me}
                      className={`min-h-[44px] px-3 rounded-xl text-sm font-bold border disabled:opacity-40 ${filter === k ? "text-white border-transparent" : "bg-white text-gray-800 border-gray-300"}`}
                      style={filter === k ? { background: CONTEST_NAVY } : undefined}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {ranked.length === 0 ? (
                <p className="rounded-2xl bg-white border border-gray-200 p-6 text-sm text-gray-700 text-center">No results yet — be the first to finish!</p>
              ) : listRows.length === 0 ? (
                <p className="rounded-2xl bg-white border border-gray-200 p-6 text-sm text-gray-700 text-center" data-testid="list-empty">
                  {searching ? `No one matches “${q.trim()}”.` : showPodium ? "Everyone is on the podium 🎉" : "No one here yet."}
                </p>
              ) : (
                <ol className="space-y-2" aria-label="Ranking">
                  {listRows.map((r) => {
                    const name = displayName(r);
                    const p = percentOf(r);
                    const tone = scoreTone(p);
                    return (
                      <li key={r.attempt_id} ref={r.is_me ? meRef : undefined} data-testid={r.is_me ? "my-row" : undefined}>
                        <button onClick={() => setSelected(r.attempt_id)}
                          className={`w-full text-left rounded-2xl border px-3 py-2.5 flex items-center gap-3 min-h-[60px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            r.is_me ? "bg-amber-50 border-amber-300" : selected === r.attempt_id ? "bg-indigo-50 border-indigo-300" : "bg-white border-gray-200"}`}>
                          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums shrink-0 bg-gray-100 text-gray-900">#{r.rank}</span>
                          <Avatar name={name} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-gray-900 truncate">{name}{r.is_me ? " (You)" : ""}</span>
                            <span className="mt-1 block h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden>
                              <span className="block h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: tone.bar }} />
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className={`block text-sm font-bold tabular-nums ${tone.text}`}>{Math.round(p)}%</span>
                            <span className="block text-xs text-gray-700 tabular-nums"><Clock size={11} className="inline -mt-0.5" /> {mmss(r.time_taken_seconds)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* desktop: details next to the list */}
            <aside className="hidden lg:block sticky top-4 rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
              {sel ? <Detail row={sel} all={ranked} /> : me ? <Detail row={me} all={ranked} /> : (
                <p className="text-sm text-gray-700">Tap a student to see their result.</p>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* phones: details as a bottom sheet */}
      {sel && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Result details">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-5 shadow-2xl" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <Detail row={sel} all={ranked} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}

      {/* phones: "You" bar while your row is off-screen */}
      {me && !meVisible && !sel && (
        <button onClick={scrollToMe} data-testid="you-bar"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-amber-50 border-t-2 border-amber-300 px-4 flex items-center gap-3 min-h-[60px] text-left"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold bg-white text-gray-900 tabular-nums">#{me.rank}</span>
          <span className="flex-1 text-sm font-bold text-amber-900">You are #{me.rank} of {total}</span>
          <span className={`text-sm font-bold tabular-nums ${scoreTone(percentOf(me)).text}`}>{Math.round(percentOf(me))}%</span>
        </button>
      )}
    </div>
  );
}
