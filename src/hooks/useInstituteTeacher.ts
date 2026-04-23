// src/hooks/useInstituteTeacher.ts
// Hook for teachers to fetch their institute membership, assigned batches, and students

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface InstituteMembership {
  institute_id: string;
  institute_name: string;
  join_code: string;
  role: string;
}

interface AssignedBatch {
  id: string;
  name: string;
  class_level: string;
  subject: string;
}

interface BatchStudent {
  id: string;
  name: string;
  roll_no: string;
  class_level: string;
  parent_phone: string;
  batch_id: string;
  batch_name: string;
}

export interface InstituteTeacherData {
  membership: InstituteMembership | null;
  batches: AssignedBatch[];
  students: BatchStudent[];
  loading: boolean;
  refetch: () => void;
}

export function useInstituteTeacher(userId: string | undefined): InstituteTeacherData {
  const [membership, setMembership] = useState<InstituteMembership | null>(null);
  const [batches, setBatches] = useState<AssignedBatch[]>([]);
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    try {
      // 1. Check if teacher is part of any institute
      const { data: memberData } = await supabase
        .from("institute_members")
        .select("institute_id, role, institutes(name, join_code)")
        .eq("user_id", userId)
        .eq("status", "active")
        .eq("role", "teacher")
        .single();

      if (!memberData) {
        setMembership(null);
        setLoading(false);
        return;
      }

      const inst = (memberData as any).institutes;
      setMembership({
        institute_id: memberData.institute_id,
        institute_name: inst?.name || "Unknown",
        join_code: inst?.join_code || "",
        role: memberData.role,
      });

      // 2. Get assigned batches
      const { data: batchTeacherData } = await supabase
        .from("batch_teachers")
        .select("batch_id, batches(id, name, class_level, subject)")
        .eq("teacher_id", userId);

      const assignedBatches: AssignedBatch[] = (batchTeacherData || [])
        .map((bt: any) => bt.batches)
        .filter(Boolean);

      setBatches(assignedBatches);

      // 3. Get students from assigned batches
      if (assignedBatches.length > 0) {
        const batchIds = assignedBatches.map((b) => b.id);
        const { data: studentData } = await supabase
          .from("students")
          .select("id, name, roll_no, class_level, parent_phone, batch_id, batches(name)")
          .eq("institute_id", memberData.institute_id)
          .in("batch_id", batchIds)
          .eq("is_active", true)
          .order("name", { ascending: true });

        setStudents(
          (studentData || []).map((s: any) => ({
            ...s,
            batch_name: s.batches?.name || "—",
          }))
        );
      } else {
        // If no specific batch assigned, show all institute students
        const { data: allStudents } = await supabase
          .from("students")
          .select("id, name, roll_no, class_level, parent_phone, batch_id, batches(name)")
          .eq("institute_id", memberData.institute_id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        setStudents(
          (allStudents || []).map((s: any) => ({
            ...s,
            batch_name: s.batches?.name || "Unassigned",
          }))
        );
      }
    } catch (err) {
      console.error("useInstituteTeacher error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [userId]);

  return { membership, batches, students, loading, refetch: fetchData };
}