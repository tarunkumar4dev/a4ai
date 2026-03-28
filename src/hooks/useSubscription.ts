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
      const { data, error } = await supabase.rpc("get_user_plan_status", {
        p_user_id: user.id,
      });
      if (!error && data) {
        setStatus(data as PlanStatus);
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