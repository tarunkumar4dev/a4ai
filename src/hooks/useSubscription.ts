// src/hooks/useSubscription.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/providers/AuthProvider";

export type PlanSlug = "free" | "starter" | "pro" | "institute_start" | "institute_scale" | "institute_enterprise";

export interface Plan {
  id: string;
  slug: PlanSlug;
  display_name: string;
  price_paise: number;
  test_limit: number;
  billing_cycle: string;
  features: string[];
  sort_order: number;
  category?: string;
}

export interface PlanStatus {
  plan_slug: PlanSlug;
  plan_name: string;
  test_limit: number;
  price_paise: number;
  features: string[];
  tests_used: number;
  tests_remaining: number;
  billing_period: string;
  subscription_status: string;
  subscription_expires: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setPlans(data as Plan[]);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [rpcRes, testsRes] = await Promise.all([
        supabase.rpc("get_user_plan_status", { p_user_id: user.id }),
        supabase
          .from("tests")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id)
          .gte("created_at", startOfMonth),
      ]);

      const actualTestsCount = testsRes.count || 0;

      if (!rpcRes.error && rpcRes.data) {
        const planStatus = rpcRes.data as PlanStatus;
        const effectiveUsed = Math.max(planStatus.tests_used || 0, actualTestsCount);
        const effectiveLimit = planStatus.test_limit;
        const effectiveRemaining =
          effectiveLimit === -1
            ? -1
            : Math.max(0, effectiveLimit - effectiveUsed);

        setStatus({
          ...planStatus,
          tests_used: effectiveUsed,
          tests_remaining: effectiveRemaining,
        });
      } else if (actualTestsCount >= 0) {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                tests_used: Math.max(prev.tests_used || 0, actualTestsCount),
                tests_remaining:
                  prev.test_limit === -1
                    ? -1
                    : Math.max(0, prev.test_limit - actualTestsCount),
              }
            : null
        );
      }
    } catch (err) {
      console.warn("[useSubscription] fetchStatus error:", err);
    }
  }, [user]);

  const canGenerateTest = useCallback((): {
    allowed: boolean;
    reason?: string;
  } => {
    if (!status) return { allowed: false, reason: "loading" };
    if (status.tests_remaining === -1) return { allowed: true };
    if (status.tests_remaining > 0) return { allowed: true };
    return {
      allowed: false,
      reason: `You've used all ${status.test_limit} test papers for this month. Upgrade to generate more.`,
    };
  }, [status]);

  const refreshAfterGeneration = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPlans(), fetchStatus()]);
      setLoading(false);
    };
    init();
  }, [fetchPlans, fetchStatus]);

  return {
    plans,
    status,
    loading,
    canGenerateTest,
    refreshAfterGeneration,
    refreshStatus: fetchStatus,
  };
}