// src/hooks/useGuestAccess.ts
// Manages guest/demo mode for test generator
// Allows 2 free test generations without login
// Gates download, share, save behind login

import { useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";

const GUEST_KEY = "a4ai_guest_tests";
const MAX_GUEST_TESTS = 2;
const GUEST_TEST_DATA_KEY = "a4ai_guest_test_data";

export interface GuestAccessState {
  isGuest: boolean;             // true if not logged in
  testsGenerated: number;       // how many tests generated as guest
  canGenerate: boolean;         // can generate more tests?
  remainingTests: number;       // tests left before login required
  needsLoginForAction: boolean; // set when user tries gated action
}

export function useGuestAccess() {
  const { session } = useAuth();
  const isGuest = !session;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginAction, setLoginAction] = useState<string>("");

  // Get guest test count from localStorage
  const getGuestCount = (): number => {
    try {
      return parseInt(localStorage.getItem(GUEST_KEY) || "0", 10);
    } catch {
      return 0;
    }
  };

  // Increment guest test count
  const incrementGuestCount = useCallback(() => {
    if (!isGuest) return; // logged in users don't count
    const current = getGuestCount();
    localStorage.setItem(GUEST_KEY, String(current + 1));
  }, [isGuest]);

  // Check if guest can generate
  const canGenerate = !isGuest || getGuestCount() < MAX_GUEST_TESTS;
  const remainingTests = isGuest ? Math.max(0, MAX_GUEST_TESTS - getGuestCount()) : Infinity;

  // Gate an action behind login (download, share, save)
  const gateAction = useCallback((action: string): boolean => {
    if (!isGuest) return true; // logged in, allow
    setLoginAction(action);
    setShowLoginModal(true);
    return false; // blocked
  }, [isGuest]);

  // Save current test data for restore after login
  const saveTestDataForRestore = useCallback((testData: any) => {
    try {
      localStorage.setItem(GUEST_TEST_DATA_KEY, JSON.stringify(testData));
    } catch (e) {
      console.warn("Failed to save test data for restore:", e);
    }
  }, []);

  // Get saved test data after login
  const getRestoredTestData = useCallback(() => {
    try {
      const data = localStorage.getItem(GUEST_TEST_DATA_KEY);
      if (data) {
        localStorage.removeItem(GUEST_TEST_DATA_KEY); // clean up
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn("Failed to restore test data:", e);
    }
    return null;
  }, []);

  // Reset guest count (after login/signup)
  const resetGuestCount = useCallback(() => {
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(GUEST_TEST_DATA_KEY);
  }, []);

  return {
    isGuest,
    canGenerate,
    remainingTests,
    testsGenerated: getGuestCount(),
    incrementGuestCount,
    gateAction,
    showLoginModal,
    setShowLoginModal,
    loginAction,
    saveTestDataForRestore,
    getRestoredTestData,
    resetGuestCount,
  };
}