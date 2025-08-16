import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

type Attempt = { user_id: string; score: number | null; submitted_at: string | null };

const LeaderboardPage = () => {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const [rows, setRows] = useState<Attempt[]>([]);

  const fetchRows = async () => {
    const { data } = await supabase
      .from("contest_attempts")
      .select("user_id, score, submitted_at")
      .eq("contest_code", code)
      .order("score", { ascending: false })
      .order("submitted_at", { ascending: true });
    setRows(data ?? []);
  };

  useEffect(() => {
    if (!code) return;
    fetchRows();

    const channel = supabase
      .channel(`lb_${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contest_attempts', filter: `contest_code=eq.${code}` },
        () => fetchRows()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Leaderboard – {code}</h1>
      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">No submissions yet.</div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.user_id}-${i}`} className="flex justify-between bg-white p-3 rounded border">
              <span>#{i + 1}</span>
              <span className="font-medium">{r.user_id.slice(0, 8)}…</span>
              <span className="font-semibold">{r.score ?? 0}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default LeaderboardPage;