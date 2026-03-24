// src/components/UsageGate.tsx
// Wrap your "Generate Test" button with this component.
// It checks limits before allowing generation and shows upgrade prompt when limit reached.

import { useSubscription } from "@/hooks/useSubscription";
import { Crown, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UsageGateProps {
  children: (props: {
    onGenerate: () => Promise<boolean>; // returns true if allowed (UI check)
    onGenerationComplete: () => Promise<void>; // call after successful generation
    testsUsed: number;
    testsLimit: number; // -1 = unlimited
    testsRemaining: number;
    planName: string;
  }) => React.ReactNode;
}

/**
 * Usage:
 * <UsageGate>
 *   {({ onGenerate, onGenerationComplete, testsRemaining }) => (
 *     <button onClick={async () => {
 *       const allowed = await onGenerate();
 *       if (!allowed) return; // limit reached, banner shows
 *       await generateTest(...);  // your API call
 *       await onGenerationComplete(); // refresh usage counts
 *     }}>
 *       Generate Test ({testsRemaining === -1 ? '∞' : testsRemaining} left)
 *     </button>
 *   )}
 * </UsageGate>
 */
export function UsageGate({ children }: UsageGateProps) {
  const { status, canGenerateTest, refreshAfterGeneration, loading } = useSubscription();

  const onGenerate = async (): Promise<boolean> => {
    const check = canGenerateTest();
    if (!check.allowed) return false;
    // Backend handles actual usage increment in test_generator.py
    // Just return true so frontend proceeds with the API call
    return true;
  };

  // Call this AFTER successful generation to refresh UI counts
  const onGenerationComplete = async () => {
    await refreshAfterGeneration();
  };

  if (loading || !status) {
    return <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />;
  }

  return (
    <>
      {children({
        onGenerate,
        onGenerationComplete,
        testsUsed: status.tests_used,
        testsLimit: status.test_limit,
        testsRemaining: status.tests_remaining,
        planName: status.plan_name,
      })}
    </>
  );
}

/**
 * Simple upgrade banner shown when limit is reached.
 * Drop this anywhere you want to show the upgrade prompt.
 */
export function UpgradeBanner() {
  const { status } = useSubscription();
  const navigate = useNavigate();

  if (!status) return null;
  // Don't show if unlimited or still has quota
  if (status.tests_remaining === -1 || status.tests_remaining > 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Monthly limit reached
          </h3>
          <p className="text-xs sm:text-sm text-amber-700/90 dark:text-amber-300 mt-1">
            You've used all {status.test_limit} test papers on your {status.plan_name} plan this month.
          </p>
          <button
            onClick={() => navigate("/payment")}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
          >
            <Crown className="h-4 w-4" />
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Usage progress bar — shows tests used / limit.
 * Good for dashboard or sidebar.
 */
export function UsageBar() {
  const { status } = useSubscription();

  if (!status) return null;

  const isUnlimited = status.test_limit === -1;
  const percent = isUnlimited ? 0 : Math.min(100, (status.tests_used / status.test_limit) * 100);
  const isNearLimit = !isUnlimited && percent >= 80;
  const isAtLimit = !isUnlimited && status.tests_remaining <= 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>
          Test papers: {status.tests_used}/{isUnlimited ? "∞" : status.test_limit}
        </span>
        <span className="font-medium text-gray-900 dark:text-white">
          {status.plan_name}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit
                ? "bg-red-500"
                : isNearLimit
                ? "bg-amber-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}