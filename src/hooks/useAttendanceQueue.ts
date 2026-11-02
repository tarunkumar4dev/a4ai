import { useCallback, useEffect, useState } from "react";
import { listQueuedSaves, type AttendanceSave } from "@/lib/offline/attendanceQueue";
import { subscribe, type QueueItem } from "@/lib/offline/secureQueue";

/** This user's attendance saves still on this device. Follows changes from this tab and other tabs. */
export function useAttendanceQueue(userId: string | undefined) {
  const [items, setItems] = useState<QueueItem<AttendanceSave>[]>([]);

  const reload = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    const res = await listQueuedSaves(userId);
    setItems(res.items);
  }, [userId]);

  useEffect(() => {
    reload();
    return subscribe(reload);
  }, [reload]);

  return items;
}
