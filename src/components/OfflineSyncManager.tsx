// Replays saves kept on this device (src/lib/offline/attendanceQueue.ts) when the connection is back, on any page.
// Sends nothing while the queue is empty; retries back off, and a hidden tab waits until it is visible again.
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { flushAttendanceQueue, onFlushDone } from "@/lib/offline/attendanceQueue";
import { subscribe } from "@/lib/offline/secureQueue";

const FIRST_RETRY_MS = 15000;
const MAX_RETRY_MS = 5 * 60 * 1000;

const saves = (n: number) => `${n} attendance save${n === 1 ? "" : "s"}`;

export default function OfflineSyncManager() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let delay = FIRST_RETRY_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = (ms: number) => {
      if (timer === undefined) timer = setTimeout(run, ms);
    };

    async function run() {
      clearTimeout(timer);
      timer = undefined;
      if (document.hidden) return;
      const r = await flushAttendanceQueue(userId as string);
      if (!alive) return;
      if (r.waiting) {
        arm(delay);
        delay = Math.min(delay * 2, MAX_RETRY_MS);
      } else {
        delay = FIRST_RETRY_MS;
      }
    }

    const retryNow = () => { delay = FIRST_RETRY_MS; run(); };
    const onVisible = () => { if (!document.hidden) run(); };

    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", onVisible);
    const unsubscribe = subscribe(() => arm(delay)); // a new save
    const stopAnnouncing = onFlushDone(r => {
      if (r.synced) toast.success(`${saves(r.synced)} synced`);
      if (r.conflicts) toast.warning(`${saves(r.conflicts)} changed by someone else. Open Attendance to choose which marks to keep.`);
      if (r.rejected) toast.error(`${saves(r.rejected)} refused by the server. Open Attendance for the reason.`);
      if (r.expired) toast.error(`${saves(r.expired)} older than 7 days removed from this device without syncing.`);
    });
    run();

    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
      stopAnnouncing();
    };
  }, [userId]);

  return null;
}
