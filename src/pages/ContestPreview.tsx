// src/pages/ContestPreview.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  Clock,
  Trophy,
  Coins,
  Users,
  ShieldCheck,
  Info,
  ArrowLeft,
  PlayCircle,
} from "lucide-react";

// --- Helper: detect UUID-ish strings (simple & safe) ---
const isUuid = (s?: string | null) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s || "");

// --- Type from your previous version (kept flexible/optional) ---
type Contest = {
  id: string;
  slug?: string | null;               // <— add this if you have a slug column
  title?: string | null;
  description?: string | null;
  banner_url?: string | null;
  start_time?: string | null;         // ISO (DB) or human string (fallback)
  duration_minutes?: number | null;
  entry_fee_coins?: number | null;
  max_participants?: number | null;
  rules?: string[] | null;
  prizes?: string[] | null;
  invite_code?: string | null;
  created_by?: string | null;
  tags?: string[] | null;
  difficulty?: string | null;
  subject?: string | null;
};

// Optional local fallback map if you preview seeded contests by slug
const LOCAL_FALLBACK: Record<string, Partial<Contest>> = {
  "math-weekly": {
    id: "math-weekly",
    slug: "math-weekly",
    title: "Math Weekly #24",
    description:
      "Test your mathematical skills in this weekly challenge covering algebra, geometry, and calculus.",
    start_time: null,
    duration_minutes: 60,
    entry_fee_coins: 50,
    tags: ["Math", "Weekly"],
    difficulty: "Intermediate",
    prizes: ["$500 + 500 coins", "$300 + 300 coins", "$200 + 200 coins"],
    rules: [
      "No external calculators allowed",
      "Must complete within time limit",
      "One attempt per participant",
    ],
  },
  "sci-lab": {
    id: "sci-lab",
    slug: "sci-lab",
    title: "Science Lab Sprint",
    description:
      "Fast-paced science challenge testing physics, chemistry & biology with interactive scenarios.",
    duration_minutes: 45,
    entry_fee_coins: 50,
    tags: ["Science", "Mixed"],
    difficulty: "Advanced",
  },
  "gk-rapid": {
    id: "gk-rapid",
    slug: "gk-rapid",
    title: "GK Rapid Fire",
    description:
      "Quick-fire general knowledge: current affairs, history, geography and more.",
    duration_minutes: 25,
    entry_fee_coins: 50,
    tags: ["GK", "Rapid"],
    difficulty: "Beginner",
  },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // if you pass a human string, just show it
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ContestPreview() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contest, setContest] = useState<Contest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entryFee = contest?.entry_fee_coins ?? 0;
  const duration = contest?.duration_minutes ?? 0;

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!contestId) {
        setError("Missing contest id.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // Decide which column to filter on: id (uuid) vs slug (text)
        const byUuid = isUuid(contestId);

        const query = supabase
          .from("contests")
          .select(
            // Adjust the column list to match your schema
            "id, slug, title, description, banner_url, start_time, duration_minutes, entry_fee_coins, max_participants, rules, prizes, invite_code, tags, difficulty, subject"
          )
          .limit(1);

        const { data, error } = byUuid
          ? await query.eq("id", contestId).maybeSingle<Contest>()
          : await query.eq("slug", contestId).maybeSingle<Contest>();

        if (!alive) return;

        if (error) {
          // If DB lookup failed AND you have a local fallback, try it
          const local = LOCAL_FALLBACK[contestId];
          if (local) {
            setContest(local as Contest);
          } else {
            setError(error.message || "Failed to load contest.");
            setContest(null);
          }
        } else if (!data) {
          // Not found in DB — try local fallback
          const local = LOCAL_FALLBACK[contestId];
          if (local) {
            setContest(local as Contest);
          } else {
            setError("Contest not found.");
            setContest(null);
          }
        } else {
          setContest(data);
        }
      } catch (e: any) {
        if (!alive) return;
        const local = LOCAL_FALLBACK[contestId!];
        if (local) {
          setContest(local as Contest);
        } else {
          setError(e?.message || "Unexpected error.");
          setContest(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [contestId]);

  const tagList = useMemo(() => {
    const tags: string[] = [];
    if (contest?.subject) tags.push(contest.subject);
    if (contest?.difficulty) tags.push(contest.difficulty);
    if (contest?.tags?.length) tags.push(...contest.tags);
    return Array.from(new Set(tags.filter(Boolean)));
  }, [contest]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-64 w-full bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-24 w-full bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Error loading contest</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Contest not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>It looks like this contest doesn’t exist or was removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl shadow-sm bg-gradient-to-br from-gray-100 to-white dark:from-gray-900 dark:to-gray-950 border border-gray-200/60 dark:border-gray-800/60">
        {contest.banner_url ? (
          <img
            src={contest.banner_url}
            alt={contest.title ?? "Contest banner"}
            className="w-full h-56 sm:h-72 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-56 sm:h-72 grid place-content-center">
            <PlayCircle className="h-12 w-12 opacity-30" />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="mt-6 flex flex-col gap-3">
        <h1
          className="text-2xl sm:text-3xl font-semibold"
          style={{
            fontFamily:
              "'Halenoir Expanded DemiBold','Halenoir Expanded','Halenoir','Inter',system-ui,sans-serif",
          }}
        >
          {contest.title ?? "Untitled Contest"}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {tagList.map((t) => (
            <Badge key={t} variant="secondary" className="rounded-full">
              {t}
            </Badge>
          ))}
          {entryFee > 0 ? (
            <Badge className="rounded-full">
              <Coins className="h-3.5 w-3.5 mr-1" /> {entryFee} coins
            </Badge>
          ) : (
            <Badge className="rounded-full">Free</Badge>
          )}
        </div>
      </div>

      {/* Meta cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-start gap-3">
            <CalendarDays className="h-5 w-5 mt-1 opacity-70" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Starts
              </p>
              <p className="text-sm">{fmtDateTime(contest.start_time)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 mt-1 opacity-70" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Duration
              </p>
              <p className="text-sm">{duration ? `${duration} min` : "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-start gap-3">
            <Users className="h-5 w-5 mt-1 opacity-70" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Max Participants
              </p>
              <p className="text-sm">
                {contest.max_participants ? contest.max_participants : "Unlimited"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 mt-1 opacity-70" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Fair Play
              </p>
              <p className="text-sm">Proctoring & Anti-cheat enabled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main sections */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: About + Rules */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>About this contest</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              {contest.description ? (
                <p className="leading-relaxed">{contest.description}</p>
              ) : (
                <p className="text-muted-foreground">
                  Get ready to test your speed and accuracy. Attempt all questions within the time
                  limit. Rankings are based on score and submission time.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2">
                {(contest.rules && contest.rules.length > 0
                  ? contest.rules
                  : [
                      "Ensure a stable internet connection.",
                      "Do not switch tabs or use unfair means.",
                      "Your camera/mic may be used for proctoring.",
                      "Once started, the timer will not pause.",
                    ]
                ).map((r, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right: Join & Prizes */}
        <div className="space-y-6">
          <Card className="rounded-2xl sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-sm text-muted-foreground">Entry Fee</div>
                <div className="text-lg font-semibold">
                  {entryFee > 0 ? `${entryFee} coins` : "Free"}
                </div>
              </div>

              <Separator className="my-4" />

              <Button
                className="w-full"
                onClick={() => {
                  if (contest.invite_code) {
                    navigate(`/contests/join?code=${encodeURIComponent(contest.invite_code)}`);
                  } else {
                    navigate("/contests/join");
                  }
                }}
              >
                Join Contest
              </Button>

              <p className="text-xs mt-3 text-muted-foreground">
                Coins are non-refundable once the contest starts. Make sure you’re ready before
                joining.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Prizes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(contest.prizes && contest.prizes.length > 0
                  ? contest.prizes
                  : ["Top 1–3 get bonus coins and certificate", "All participants receive e-badge"]
                ).map((p, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    • {p}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
